import { describe, expect, it } from 'vitest'

import type { AnalysisProgress } from '../server/analysis-types'
import type { Task } from '../server/task-types'
import {
  analysisRequestIds,
  availableSelection,
  deselectFiltered,
  filteredSelectionIds,
  selectFiltered,
  toggleSelection,
} from './analysis-selection'

function task(id: string): Task {
  return {
    id,
    title: id,
    createdAt: 1,
    updatedAt: 2,
    pinned: false,
    projectId: null,
    projectName: null,
    automationId: null,
  }
}

describe('analysis selection', () => {
  it('keeps task IDs selected across page and filter changes', () => {
    const selected = toggleSelection(toggleSelection([], 'first'), 'later-page')
    expect(selected).toEqual(['first', 'later-page'])
    expect(
      availableSelection(selected, [task('first'), task('later-page')]),
    ).toEqual(selected)
  })

  it('drops tasks missing from a refreshed snapshot before submission', () => {
    expect(availableSelection(['old', 'current'], [task('current')])).toEqual([
      'current',
    ])
    expect(toggleSelection(['current'], 'current')).toEqual([])
  })

  it('submits only available IDs after an explicit start with a ready status', () => {
    const progress: AnalysisProgress = {
      status: 'idle',
      total: 0,
      completed: 0,
      analyzed: 0,
      cached: 0,
      failed: 0,
      inputTokens: 0,
      outputTokens: 0,
      elapsedMs: 0,
      lastCompletedId: null,
    }
    const ready = { configured: true, progress }
    expect(
      analysisRequestIds(
        ['missing', 'current'],
        [task('current')],
        ready,
        false,
      ),
    ).toEqual(['current'])
    expect(
      analysisRequestIds(['current'], [task('current')], null, false),
    ).toEqual([])
    expect(
      analysisRequestIds(
        ['current'],
        [task('current')],
        { ...ready, configured: false },
        false,
      ),
    ).toEqual([])
    expect(
      analysisRequestIds(
        ['current'],
        [task('current')],
        { ...ready, progress: { ...progress, status: 'running' } },
        false,
      ),
    ).toEqual([])
    expect(
      analysisRequestIds(['current'], [task('current')], ready, true),
    ).toEqual([])
  })
})

describe('filtered selection', () => {
  it('uses every task before pagination or only matching automation runs', () => {
    const first = task('first')
    const later = task('later')
    const ordinary = task('ordinary')
    const group = {
      id: 'automation',
      latest: later,
      runs: [first],
      additionalSignals: [],
    }
    expect(
      filteredSelectionIds([first, later, ordinary], [group], false),
    ).toEqual(['first', 'later', 'ordinary'])
    expect(
      filteredSelectionIds([first, later, ordinary], [group], true),
    ).toEqual(['first'])
  })

  it('selects every filtered ID once while preserving selections outside the filter', () => {
    expect(
      selectFiltered(['outside', 'first'], ['first', 'later', 'later']),
    ).toEqual(['outside', 'first', 'later'])
    expect(
      deselectFiltered(['outside', 'first', 'later'], ['first', 'later']),
    ).toEqual(['outside'])
  })
})
