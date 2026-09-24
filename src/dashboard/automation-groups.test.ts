import { describe, expect, it } from 'vitest'

import type { AnalysisView } from '../server/analysis-types'
import type { Task } from '../server/task-types'
import { automationGroups } from './automation-groups'
import { filterTasks, tasksInView } from './task-filter'

function task(
  id: string,
  automationId: string | null,
  createdAt: number,
): Task {
  return {
    id,
    title: id,
    createdAt,
    updatedAt: createdAt + 1,
    pinned: id === 'older',
    projectId: id === 'other' ? 'other' : 'project',
    projectName: id === 'other' ? 'Other' : 'Project',
    automationId,
  }
}

const tasks = [
  task('older', 'stable_id', 1),
  task('newest', 'stable_id', 3),
  task('other', 'second_id', 2),
  task('ordinary', null, 4),
  task('invalid', 'bad id', 5),
]

function view(
  taskId: string,
  status: 'current' | 'stale',
  openAction: number,
): AnalysisView {
  return {
    taskId,
    status,
    analysis: {
      taskId,
      updatedAt: 1,
      pinned: false,
      analyzedAt: 2,
      model: null,
      rubricVersion: 'codex-triage-v2',
      advice: 'review',
      reason: 'uncertain',
      signals: { completed: 0.1, openAction, obsolete: 0.1 },
      inputTokens: 0,
      outputTokens: 0,
      elapsedMs: 0,
    },
  }
}

describe('automation groups', () => {
  it('groups stable IDs and keeps missing or invalid IDs ordinary', () => {
    const groups = automationGroups(tasks, tasks, [])
    expect(groups.map((group) => group.id)).toEqual(['stable_id', 'second_id'])
    expect(groups[0]?.runs.map((run) => run.id)).toEqual(['newest', 'older'])
    expect(groups[0]?.latest.id).toBe('newest')
  })

  it('retains the true newest run when a filter hides it', () => {
    const visible = filterTasks(
      tasksInView(tasks, 'pinned'),
      { kind: 'project', id: 'project' },
      'older',
      'en-US',
    )
    const [group] = automationGroups(tasks, visible, [])
    expect(group?.latest.id).toBe('newest')
    expect(group?.runs.map((run) => run.id)).toEqual(['older'])
  })

  it('shows only distinct additional signal types from current older analyses', () => {
    const current = automationGroups(tasks, tasks, [
      view('newest', 'current', 0.1),
      view('older', 'current', 0.91),
      view('other', 'stale', 0.95),
    ])
    expect(current[0]?.additionalSignals).toEqual(['openAction'])
    const stale = automationGroups(tasks, tasks, [
      view('newest', 'current', 0.1),
      view('older', 'stale', 0.91),
    ])
    expect(stale[0]?.additionalSignals).toEqual([])
  })

  it('applies project and search filters to matching run counts', () => {
    const visible = filterTasks(
      tasksInView(tasks, 'unpinned'),
      { kind: 'project', id: 'project' },
      'newest',
      'en-US',
    )
    expect(
      automationGroups(tasks, visible, []).map((group) => [
        group.id,
        group.runs.length,
      ]),
    ).toEqual([['stable_id', 1]])
  })
})
