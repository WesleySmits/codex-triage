import { stat, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CodexClient, type CodexClientLike } from './codex-client'
import type { CodexThread } from './codex-types'

export interface Task {
  id: string
  title: string | null
  createdAt: number
  updatedAt: number
  pinned: boolean
  projectId: string | null
  projectName: string | null
  automationId: string | null
}

export interface Project {
  id: string
  name: string | null
}

export interface Snapshot {
  tasks: Task[]
  projects: Project[]
  refreshedAt: number | null
  error: string | null
}

export interface ExpectedTask {
  id: string
  createdAt: number
  updatedAt: number
  pinned: boolean
}

export type ArchiveResult =
  | { status: 'complete'; confirmedIds: string[]; snapshot: Snapshot }
  | { status: 'continue'; confirmedIds: string[]; snapshot: Snapshot }
  | { status: 'partial'; confirmedIds: string[]; snapshot: Snapshot }
  | { status: 'uncertain'; confirmedIds: string[]; snapshot: Snapshot }
  | { status: 'stale'; confirmedIds: string[]; snapshot: Snapshot }
  | { status: 'busy'; confirmedIds: string[]; snapshot: Snapshot }

interface LocalState {
  'pinned-thread-ids'?: unknown
  'thread-project-assignments'?: unknown
  'local-projects'?: unknown
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringField(value: unknown, key: string): string | null {
  const field = record(value)[key]
  return typeof field === 'string' ? field : null
}

async function readLocalState(): Promise<LocalState> {
  const path = join(
    process.env.CODEX_HOME ?? join(homedir(), '.codex'),
    '.codex-global-state.json',
  )
  const file = await stat(path)
  if (file.size > 4_000_000)
    throw new Error('Codex state file exceeds the local size limit')
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Codex state file has an invalid shape')
  }
  return parsed
}

export function detectAutomationId(text: string): string | null {
  const lines = text.trimStart().split(/\r?\n/, 12)
  if (!/^Automation:\s*\S/.test(lines[0] ?? '')) return null
  const line = lines
    .slice(1)
    .find((entry) => entry.startsWith('Automation ID:'))
  return (
    /^Automation ID:\s*([A-Za-z0-9][A-Za-z0-9_-]{0,127})\s*$/.exec(
      line ?? '',
    )?.[1] ?? null
  )
}

function expectedMatches(task: Task, expected: ExpectedTask): boolean {
  return (
    task.id === expected.id &&
    task.createdAt === expected.createdAt &&
    task.updatedAt === expected.updatedAt &&
    task.pinned === expected.pinned
  )
}

function safeError(error: unknown): string {
  if (error instanceof Error && error.name === 'CodexClientError')
    return error.message
  return 'Could not refresh local Codex tasks'
}

function projectNames(
  rawProjects: { id: string; name: string }[],
  state: LocalState,
): Map<string, string | null> {
  const names = new Map<string, string | null>(
    rawProjects.map((project) => [project.id, project.name]),
  )
  for (const [id, project] of Object.entries(record(state['local-projects']))) {
    names.set(id, stringField(project, 'name'))
  }
  return names
}

function pinnedIds(state: LocalState): Set<string> {
  const value = state['pinned-thread-ids']
  return new Set(
    Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : [],
  )
}

async function automationIds(
  client: CodexClientLike,
  rawTasks: CodexThread[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  for (const task of rawTasks) {
    const id = detectAutomationId(task.preview)
    if (id) ids.set(task.id, id)
  }
  const fallback = rawTasks.filter(
    (task) =>
      /^Automation:\s*\S/.test(
        task.preview.trimStart().split(/\r?\n/, 1)[0] ?? '',
      ) && !ids.has(task.id),
  )
  for (let offset = 0; offset < fallback.length; offset += 8) {
    await Promise.all(
      fallback.slice(offset, offset + 8).map(async (task) => {
        try {
          const text = await client.readOpeningUserText(task.id)
          const id = text ? detectAutomationId(text) : null
          if (id) ids.set(task.id, id)
        } catch {
          /* A missing opening turn leaves the automation ID unknown. */
        }
      }),
    )
  }
  return ids
}

function taskTitle(raw: CodexThread): string | null {
  return (
    raw.name?.trim() || raw.preview.split(/\r?\n/, 1)[0]?.slice(0, 100) || null
  )
}

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
    private readonly makeClient: () => CodexClientLike = () =>
      new CodexClient(),
    private readonly loadState: () => Promise<LocalState> = readLocalState,
  ) {}

  async snapshot(): Promise<Snapshot> {
    if (this.current.refreshedAt === null && !this.current.error)
      return this.refresh()
    return this.current
  }

  /** Read archived metadata so an unarchive can carry a current expected version. */
  async archivedTasks(): Promise<ExpectedTask[]> {
    const client = this.makeClient()
    try {
      await client.connect()
      const [threads, state] = await Promise.all([
        client.listArchivedThreads(),
        this.loadState(),
      ])
      const pins = pinnedIds(state)
      return threads.map((thread) => ({
        id: thread.id,
        createdAt: thread.createdAt ?? thread.updatedAt,
        updatedAt: thread.updatedAt,
        pinned: pins.has(thread.id),
      }))
    } finally {
      client.close()
    }
  }

  /** Refresh only when explicitly requested, except for the first snapshot and write preflights. */
  async refresh(): Promise<Snapshot> {
    if (this.refreshInFlight) return this.refreshInFlight
    this.refreshInFlight = this.load()
    try {
      return await this.refreshInFlight
    } finally {
      this.refreshInFlight = null
    }
  }

  private async load(): Promise<Snapshot> {
    const client = this.makeClient()
    try {
      await client.connect()
      const [rawTasks, rawProjects, state] = await Promise.all([
        client.listActiveThreads(),
        client.listProjects(),
        this.loadState(),
      ])
      const pins = pinnedIds(state)
      const assignments = record(state['thread-project-assignments'])
      const names = projectNames(rawProjects, state)
      const ids = await automationIds(client, rawTasks)
      const tasks = rawTasks.map((raw): Task =>
        this.toTask(raw, pins, assignments, names, ids),
      )
      const projects = [...names]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
      this.current = { tasks, projects, refreshedAt: Date.now(), error: null }
      return this.current
    } catch (error) {
      this.current = { ...this.current, error: safeError(error) }
      return this.current
    } finally {
      client.close()
    }
  }

  private toTask(
    raw: CodexThread,
    pins: Set<string>,
    assignments: Record<string, unknown>,
    names: Map<string, string | null>,
    ids: Map<string, string>,
  ): Task {
    const projectId =
      raw.projectId ?? stringField(assignments[raw.id], 'projectId')
    if (projectId && !names.has(projectId)) names.set(projectId, null)
    return {
      id: raw.id,
      title: taskTitle(raw),
      createdAt: raw.createdAt ?? raw.updatedAt,
      updatedAt: raw.updatedAt,
      pinned: pins.has(raw.id),
      projectId,
      projectName: projectId ? (names.get(projectId) ?? null) : null,
      automationId: ids.get(raw.id) ?? null,
    }
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

  /** A single write requires a matching fresh task and confirms the resulting archive state. */
  async setArchived(
    expected: ExpectedTask,
    archived: boolean,
  ): Promise<ArchiveResult> {
    return this.withMutation(() => this.setArchivedLocked(expected, archived))
  }

  private async setArchivedLocked(
    expected: ExpectedTask,
    archived: boolean,
  ): Promise<ArchiveResult> {
    const fresh = await this.refresh()
    const task = fresh.tasks.find((item) => item.id === expected.id)
    if (
      fresh.error ||
      (archived ? !task || !expectedMatches(task, expected) : Boolean(task))
    ) {
      return { status: 'stale', confirmedIds: [], snapshot: fresh }
    }
    return this.writeSingle(expected, archived, fresh)
  }

  private async writeSingle(
    expected: ExpectedTask,
    archived: boolean,
    fresh: Snapshot,
  ): Promise<ArchiveResult> {
    const client = this.makeClient()
    let attempted = false
    try {
      await client.connect()
      if (!archived && !(await this.archivedMatches(client, expected))) {
        return { status: 'stale', confirmedIds: [], snapshot: fresh }
      }
      attempted = true
      if (archived) await client.archiveThread(expected.id)
      else await client.unarchiveThread(expected.id)
      const confirmed = archived
        ? (await client.listArchivedIds()).has(expected.id)
        : (await client.listActiveThreads()).some(
            (item) => item.id === expected.id,
          )
      return {
        status: confirmed ? 'complete' : 'uncertain',
        confirmedIds: confirmed ? [expected.id] : [],
        snapshot: await this.refresh(),
      }
    } catch {
      return {
        status: attempted ? 'uncertain' : 'partial',
        confirmedIds: [],
        snapshot: await this.refresh(),
      }
    } finally {
      client.close()
    }
  }

  private async archivedMatches(
    client: CodexClientLike,
    expected: ExpectedTask,
  ): Promise<boolean> {
    const task = (await client.listArchivedThreads()).find(
      (item) => item.id === expected.id,
    )
    return Boolean(
      task &&
      (task.createdAt ?? task.updatedAt) === expected.createdAt &&
      task.updatedAt === expected.updatedAt,
    )
  }

  /** Archive at most ten matching active runs in one user-triggered call. */
  async archiveAutomationGroup(
    automationId: string,
    expected: ExpectedTask[],
  ): Promise<ArchiveResult> {
    return this.withMutation(() =>
      this.archiveGroupLocked(automationId, expected),
    )
  }

  private async archiveGroupLocked(
    automationId: string,
    expected: ExpectedTask[],
  ): Promise<ArchiveResult> {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(automationId) ||
      expected.length === 0 ||
      expected.length > 20_000
    ) {
      return {
        status: 'stale',
        confirmedIds: [],
        snapshot: await this.snapshot(),
      }
    }
    const fresh = await this.refresh()
    const group = fresh.tasks.filter(
      (task) => task.automationId === automationId,
    )
    if (fresh.error || !this.groupMatches(group, expected)) {
      return { status: 'stale', confirmedIds: [], snapshot: fresh }
    }
    const batch = [...group]
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 10)
    return this.writeBatch(batch, group.length)
  }

  private groupMatches(group: Task[], expected: ExpectedTask[]): boolean {
    const byId = new Map(expected.map((task) => [task.id, task]))
    if (byId.size !== expected.length || group.length !== expected.length)
      return false
    return group.every((task) => {
      const match = byId.get(task.id)
      return match !== undefined && expectedMatches(task, match)
    })
  }

  private async writeBatch(
    batch: Task[],
    groupLength: number,
  ): Promise<ArchiveResult> {
    const client = this.makeClient()
    const attempted: string[] = []
    let writeFailed = false
    try {
      await client.connect()
      for (const task of batch) {
        attempted.push(task.id)
        try {
          await client.archiveThread(task.id)
        } catch {
          writeFailed = true
          break
        }
      }
      const archived = await client.listArchivedIds()
      const confirmedIds = attempted.filter((id) => archived.has(id))
      const status =
        writeFailed || confirmedIds.length !== attempted.length
          ? 'partial'
          : batch.length === groupLength
            ? 'complete'
            : 'continue'
      return { status, confirmedIds, snapshot: await this.refresh() }
    } catch {
      return {
        status: attempted.length ? 'uncertain' : 'partial',
        confirmedIds: [],
        snapshot: await this.refresh(),
      }
    } finally {
      client.close()
    }
  }
}

export const taskStore = new TaskStore()
