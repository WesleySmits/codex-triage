import { describe, expect, it } from 'vitest'

import type { CodexThread } from './codex-types'
import { FakeClient } from './fake-client.test-helper'
import { detectAutomationId } from './task-normalization'
import { TaskStore } from './task-store'
import type { ExpectedTask } from './task-types'

const ids = Array.from(
  { length: 12 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
)

function taskId(index: number): string {
  const id = ids[index]
  if (!id) throw new Error(`Missing synthetic task ${String(index)}`)
  return id
}

function thread(
  index: number,
  preview = 'Automation: Example\nAutomation ID: sample_job',
): CodexThread {
  return {
    id: taskId(index),
    name: `Synthetic task ${String(index + 1)}`,
    preview,
    projectId: 'synthetic-project',
    createdAt: index + 1,
    updatedAt: 100 + index,
  }
}

function deferred() {
  let resolve: () => void = () => {
    throw new Error('Deferred promise was not initialized')
  }
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function racingClient() {
  const client = new FakeClient()
  const writeStarted = deferred()
  const releaseWrite = deferred()
  const staleReadStarted = deferred()
  const releaseStaleRead = deferred()
  let delayNextRead = false
  client.listActiveThreads = () => {
    const snapshot = [...client.active]
    if (!delayNextRead) return Promise.resolve(snapshot)
    delayNextRead = false
    staleReadStarted.resolve()
    return releaseStaleRead.promise.then(() => snapshot)
  }
  const archiveThread = client.archiveThread.bind(client)
  client.archiveThread = async (id: string) => {
    writeStarted.resolve()
    await releaseWrite.promise
    return archiveThread(id)
  }
  return {
    client,
    writeStarted,
    releaseWrite,
    staleReadStarted,
    releaseStaleRead,
    delayRead() {
      delayNextRead = true
    },
  }
}

function store(client: FakeClient, pinnedIds: string[] = []) {
  return new TaskStore(
    () => client,
    () =>
      Promise.resolve({
        'pinned-thread-ids': pinnedIds,
        'thread-project-assignments': {},
        'local-projects': {},
      }),
  )
}

function expected(task: CodexThread, pinned = false): ExpectedTask {
  return {
    id: task.id,
    createdAt: task.createdAt ?? task.updatedAt,
    updatedAt: task.updatedAt,
    pinned,
  }
}

describe('local task state', () => {
  it('accepts an exact automation ID and rejects title-only guesses', () => {
    expect(
      detectAutomationId('Automation: Example\nAutomation ID: job_12'),
    ).toBe('job_12')
    expect(detectAutomationId('Automation: Example')).toBeNull()
    expect(detectAutomationId('Normal task\nAutomation ID: job_12')).toBeNull()
  })

  it('loads a memory snapshot and changes it only on explicit refresh', async () => {
    const client = new FakeClient()
    client.active = [thread(0)]
    const taskStore = store(client, [taskId(0)])
    const first = await taskStore.snapshot()
    expect(first.tasks[0]).toMatchObject({
      pinned: true,
      projectName: 'Example project',
      automationId: 'sample_job',
    })
    client.active = [thread(1)]
    expect((await taskStore.snapshot()).tasks[0]?.id).toBe(ids[0])
    expect((await taskStore.refresh()).tasks[0]?.id).toBe(ids[1])
  })

  it('uses a bounded opening-turn fallback when the preview omits the ID', async () => {
    const client = new FakeClient()
    client.active = [thread(0, 'Automation: Example')]
    client.openingText = 'Automation: Example\nAutomation ID: from_opening_turn'
    expect((await store(client).snapshot()).tasks[0]?.automationId).toBe(
      'from_opening_turn',
    )
  })
})

describe('archive policy', () => {
  it('rejects a stale individual archive before any write', async () => {
    const client = new FakeClient()
    client.active = [thread(0)]
    const result = await store(client).setArchived(
      { ...expected(thread(0)), updatedAt: 1 },
      true,
    )
    expect(result.status).toBe('stale')
    expect(client.writes).toEqual([])
  })

  it('confirms an individual archive and checks metadata before unarchive', async () => {
    const client = new FakeClient()
    const task = thread(0)
    client.active = [task]
    const taskStore = store(client)
    expect((await taskStore.setArchived(expected(task), true)).status).toBe(
      'complete',
    )
    expect(await taskStore.archivedTasks()).toEqual([expected(task)])
    expect(
      (
        await taskStore.setArchived(
          { ...expected(task), updatedAt: 999 },
          false,
        )
      ).status,
    ).toBe('stale')
    expect((await taskStore.setArchived(expected(task), false)).status).toBe(
      'complete',
    )
    expect(client.writes).toEqual([task.id, task.id])
  })
})

describe('automation group archive policy', () => {
  it('archives at most ten runs and requires a fresh remaining-group decision', async () => {
    const client = new FakeClient()
    client.active = ids.map((_, index) => thread(index))
    const taskStore = store(client)
    const all = client.active.map((task) => expected(task))
    const first = await taskStore.archiveAutomationGroup('sample_job', all)
    expect(first.status).toBe('continue')
    expect(first.confirmedIds).toHaveLength(10)
    expect(client.writes).toHaveLength(10)
    expect(
      (await taskStore.archiveAutomationGroup('sample_job', all)).status,
    ).toBe('stale')
    const remaining = client.active.map((task) => expected(task))
    expect(
      (await taskStore.archiveAutomationGroup('sample_job', remaining)).status,
    ).toBe('complete')
  })

  it('reports partial writes and uncertain readback without retrying', async () => {
    const client = new FakeClient()
    client.active = [thread(0), thread(1)]
    client.failWrite = taskId(1)
    const taskStore = store(client)
    const result = await taskStore.archiveAutomationGroup(
      'sample_job',
      client.active.map((task) => expected(task)),
    )
    expect(result.status).toBe('partial')
    expect(result.confirmedIds).toEqual([ids[0]])
    expect(client.writes).toEqual([ids[0], ids[1]])

    client.active = [thread(2)]
    client.failWrite = null
    client.failReadback = true
    const uncertain = await taskStore.setArchived(expected(thread(2)), true)
    expect(uncertain.status).toBe('uncertain')
    expect(client.writes.at(-1)).toBe(ids[2])
  })
})

describe('post-write refresh', () => {
  it('loads again after a pre-write refresh finishes', async () => {
    const race = racingClient()
    const { client } = race
    const task = thread(0)
    client.active = [task]
    const taskStore = store(client)
    const archived = taskStore.setArchived(expected(task), true)
    await race.writeStarted.promise

    race.delayRead()
    const staleRead = taskStore.refresh()
    await race.staleReadStarted.promise
    race.releaseWrite.resolve()
    race.releaseStaleRead.resolve()

    expect((await staleRead).tasks).toHaveLength(1)
    const result = await archived
    expect(result.status).toBe('complete')
    expect(result.snapshot.tasks).toEqual([])
    expect((await taskStore.snapshot()).tasks).toEqual([])
  })
})
