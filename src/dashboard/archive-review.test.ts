import { describe, expect, it } from 'vitest'

import type { ArchiveResult, Task } from '../server/task-types'
import {
  expectedTask,
  groupCounts,
  remainingGroup,
  remainingSelection,
} from './archive-review'

const task = (id: string, pinned = false): Task => ({
  id,
  title: id,
  createdAt: 1,
  updatedAt: 2,
  pinned,
  projectId: null,
  projectName: null,
  automationId: 'daily',
})

const result = (status: ArchiveResult['status']): ArchiveResult => ({
  status,
  confirmedIds: ['one'],
  snapshot: {
    tasks: [task('two'), task('three', true)],
    projects: [],
    refreshedAt: 3,
    error: null,
  },
})

describe('archive review', () => {
  it('copies expected state and counts pinned group runs', () => {
    expect(expectedTask(task('one', true))).toEqual({
      id: 'one',
      createdAt: 1,
      updatedAt: 2,
      pinned: true,
    })
    expect(groupCounts([task('one'), task('two', true)])).toEqual({
      total: 2,
      pinned: 1,
    })
  })

  it('offers a new review only after continue, using the returned snapshot', () => {
    const target = {
      kind: 'group' as const,
      automationId: 'daily',
      tasks: [task('one')],
    }
    expect(remainingGroup({ target, result: result('continue') })).toEqual({
      kind: 'group',
      automationId: 'daily',
      tasks: [task('two'), task('three', true)],
    })
    for (const status of [
      'partial',
      'uncertain',
      'stale',
      'busy',
      'complete',
    ] as const)
      expect(remainingGroup({ target, result: result(status) })).toBeNull()
    expect(
      remainingGroup({
        target,
        result: {
          ...result('continue'),
          snapshot: { ...result('continue').snapshot, error: 'refresh failed' },
        },
      }),
    ).toBeNull()
  })

  it('keeps unconfirmed selected tasks for an explicit next review', () => {
    const target = {
      kind: 'selection' as const,
      tasks: [task('one'), task('two'), task('three', true)],
    }
    expect(remainingSelection({ target, result: result('continue') })).toEqual({
      kind: 'selection',
      tasks: [task('two'), task('three', true)],
    })
    expect(remainingSelection({ target, result: result('partial') })).toBeNull()
  })
})
