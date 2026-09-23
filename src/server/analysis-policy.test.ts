import { describe, expect, it } from 'vitest'

import { advise } from './analysis-policy'

describe('Jev advice policy', () => {
  it('keeps a task with an open action', () => {
    expect(
      advise(
        { completed: 0.9, openAction: 0.8, stillRelevant: 0.9, outdated: 0.1 },
        false,
      ),
    ).toEqual({ advice: 'keep', reason: 'active' })
  })

  it('only advises archive for a completed unpinned task', () => {
    const signals = {
      completed: 0.91,
      openAction: 0.1,
      stillRelevant: 0.8,
      outdated: 0.1,
    }
    expect(advise(signals, false)).toEqual({
      advice: 'archive',
      reason: 'completed',
    })
    expect(advise(signals, true)).toEqual({
      advice: 'review',
      reason: 'pinned',
    })
  })

  it('routes uncertain evidence to review', () => {
    expect(
      advise(
        { completed: 0.6, openAction: 0.4, stillRelevant: 0.5, outdated: 0.4 },
        false,
      ),
    ).toEqual({ advice: 'review', reason: 'uncertain' })
  })
})
