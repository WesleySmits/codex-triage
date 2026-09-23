import { createCodexClient } from './codex-client'
import type { CodexClientLike } from './codex-types'
import { writeBatch, writeSingle } from './archive-operations'
import { canChangeArchiveState, currentAutomationGroup } from './archive-policy'
import { readLocalState, type LocalState } from './local-codex-state'
import {
  normalizeActiveTasks,
  normalizeArchivedTasks,
} from './task-normalization'
import type {
  ArchiveOutcome,
  ArchiveResult,
  ExpectedTask,
  Snapshot,
} from './task-types'

/** Holds one in-memory snapshot and serializes user-triggered archive writes. */
export class TaskStore {
  private current: Snapshot = {
    tasks: [],
    projects: [],
    refreshedAt: null,
    error: null,
  }
  private refreshInFlight: Promise<Snapshot> | null = null
  private mutating = false

  constructor(
    private readonly makeClient: () => CodexClientLike = createCodexClient,
    private readonly loadState: () => Promise<LocalState> = readLocalState,
  ) {}

  async snapshot(): Promise<Snapshot> {
    if (this.current.refreshedAt === null && !this.current.error)
      return this.refresh()
    return this.current
  }

  /** Refresh only on explicit request, first access, or before and after a write. */
  async refresh(): Promise<Snapshot> {
    if (this.refreshInFlight) return this.refreshInFlight
    this.refreshInFlight = this.load()
    try {
      return await this.refreshInFlight
    } finally {
      this.refreshInFlight = null
    }
  }

  async archivedTasks(): Promise<ExpectedTask[]> {
    return this.withClient(async (client) => {
      const [threads, state] = await Promise.all([
        client.listArchivedThreads(),
        this.loadState(),
      ])
      return normalizeArchivedTasks(threads, state)
    })
  }

  private async withClient<T>(
    run: (client: CodexClientLike) => Promise<T>,
  ): Promise<T> {
    const client = this.makeClient()
    try {
      await client.connect()
      return await run(client)
    } finally {
      client.close()
    }
  }

  private async load(): Promise<Snapshot> {
    try {
      const result = await this.withClient(async (client) => {
        const [threads, projects, state] = await Promise.all([
          client.listActiveThreads(),
          client.listProjects(),
          this.loadState(),
        ])
        return normalizeActiveTasks(client, threads, projects, state)
      })
      this.current = { ...result, refreshedAt: Date.now(), error: null }
    } catch {
      this.current = {
        ...this.current,
        error: 'Could not refresh local Codex tasks',
      }
    }
    return this.current
  }

  private async withMutation(
    run: () => Promise<ArchiveResult>,
  ): Promise<ArchiveResult> {
    if (this.mutating)
      return {
        status: 'busy',
        confirmedIds: [],
        snapshot: await this.snapshot(),
      }
    this.mutating = true
    try {
      return await run()
    } finally {
      this.mutating = false
    }
  }

  async setArchived(
    expected: ExpectedTask,
    archived: boolean,
  ): Promise<ArchiveResult> {
    return this.withMutation(async () => {
      const fresh = await this.refresh()
      if (!canChangeArchiveState(fresh, expected, archived)) {
        return { status: 'stale', confirmedIds: [], snapshot: fresh }
      }
      const outcome = await this.runWrite((client) =>
        writeSingle(client, expected, archived),
      )
      return {
        ...outcome,
        snapshot: outcome.status === 'stale' ? fresh : await this.refresh(),
      }
    })
  }

  async archiveAutomationGroup(
    automationId: string,
    expected: ExpectedTask[],
  ): Promise<ArchiveResult> {
    return this.withMutation(async () => {
      const fresh = await this.refresh()
      const group = currentAutomationGroup(fresh, automationId, expected)
      if (!group) return { status: 'stale', confirmedIds: [], snapshot: fresh }
      const outcome = await this.runWrite((client) =>
        writeBatch(client, group.slice(0, 10), group.length),
      )
      return { ...outcome, snapshot: await this.refresh() }
    })
  }

  private async runWrite(
    run: (client: CodexClientLike) => Promise<ArchiveOutcome>,
  ): Promise<ArchiveOutcome> {
    try {
      return await this.withClient(run)
    } catch {
      return { status: 'partial', confirmedIds: [] }
    }
  }
}

export const taskStore = new TaskStore()
