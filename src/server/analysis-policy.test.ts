import { describe, expect, it } from 'vitest'

import { advise } from './analysis-policy'
import type { Advice, Signals } from './analysis-types'

interface Case {
  name: string
  advice: Advice
  signals: Signals
  pinned?: boolean
}

/** Fictional examples are policy checks, not measurements of Jev accuracy. */
const cases: Case[] = [
  {
    name: 'Unfinished implementation with a named next step',
    advice: 'keep',
    signals: { completed: 0.05, openAction: 0.95, obsolete: 0.02 },
  },
  {
    name: 'Automation run still waiting for a provider result',
    advice: 'keep',
    signals: { completed: 0.1, openAction: 0.9, obsolete: 0.05 },
  },
  {
    name: 'Question awaiting the requested answer',
    advice: 'keep',
    signals: { completed: 0.2, openAction: 0.8, obsolete: 0.05 },
  },
  {
    name: 'Completed answer with broader topic still useful',
    advice: 'archive',
    signals: { completed: 0.95, openAction: 0.05, obsolete: 0.02 },
  },
  {
    name: 'Blocked automation run reported its final result while issue continues',
    advice: 'archive',
    signals: { completed: 0.92, openAction: 0.08, obsolete: 0.02 },
  },
  {
    name: 'Explicitly replaced task with no unresolved action',
    advice: 'archive',
    signals: { completed: 0.1, openAction: 0.05, obsolete: 0.95 },
  },
  {
    name: 'Completed but pinned task',
    advice: 'review',
    pinned: true,
    signals: { completed: 0.95, openAction: 0.05, obsolete: 0.02 },
  },
  {
    name: 'Completed task claims a follow-up remains',
    advice: 'review',
    signals: { completed: 0.95, openAction: 0.85, obsolete: 0.02 },
  },
  {
    name: 'Obsolete task still has an explicit action',
    advice: 'review',
    signals: { completed: 0.05, openAction: 0.9, obsolete: 0.95 },
  },
  {
    name: 'Old task with no explicit closure evidence',
    advice: 'review',
    signals: { completed: 0.2, openAction: 0.1, obsolete: 0.1 },
  },
  {
    name: 'Ambiguous completion and open action',
    advice: 'review',
    signals: { completed: 0.6, openAction: 0.5, obsolete: 0.1 },
  },
  {
    name: 'Nearly closed task with weak no-action evidence',
    advice: 'review',
    signals: { completed: 0.85, openAction: 0.25, obsolete: 0.05 },
  },
]

describe('task-specific advice policy', () => {
  it.each(cases)('$name', ({ advice, pinned = false, signals }) => {
    expect(advise(signals, pinned).advice).toBe(advice)
  })
})
