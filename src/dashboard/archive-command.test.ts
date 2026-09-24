import { describe, expect, it, vi } from 'vitest'

import type { ArchiveResult, ExpectedTask, Task } from '../server/task-types'
import { type ArchiveCommands, executeArchive } from './archive-command'

const task: Task = {
  id: 'task-1',
  title: 'Task',
  createdAt: 1,
  updatedAt: 2,
  pinned: true,
  projectId: null,
  projectName: null,
  automationId: 'daily',
}
const expected: ExpectedTask = {
  id: 'task-1',
  createdAt: 1,
  updatedAt: 2,
  pinned: true,
}
const result: ArchiveResult = {
  status: 'complete',
  confirmedIds: ['task-1'],
  snapshot: { tasks: [], projects: [], refreshedAt: 3, error: null },
}

function commands(): ArchiveCommands {
  return {
    archiveTask: vi.fn(() => Promise.resolve(result)),
    restoreTask: vi.fn(() => Promise.resolve(result)),
    archiveGroup: vi.fn(() => Promise.resolve(result)),
  }
}

describe('reviewed archive command', () => {
  it('sends one expected-state archive call for a task', async () => {
    const calls = commands()
    await executeArchive({ kind: 'task', task }, calls)
    expect(calls.archiveTask).toHaveBeenCalledExactlyOnceWith(expected)
    expect(calls.restoreTask).not.toHaveBeenCalled()
    expect(calls.archiveGroup).not.toHaveBeenCalled()
  })

  it('sends one full group call and one individual restore call', async () => {
    const calls = commands()
    await executeArchive(
      { kind: 'group', automationId: 'daily', tasks: [task] },
      calls,
    )
    await executeArchive({ kind: 'restore', task: expected }, calls)
    expect(calls.archiveGroup).toHaveBeenCalledExactlyOnceWith('daily', [
      expected,
    ])
    expect(calls.restoreTask).toHaveBeenCalledExactlyOnceWith(expected)
    expect(calls.archiveTask).not.toHaveBeenCalled()
  })
})
