import { describe, expect, it, vi } from 'vitest'

import type { ArchiveStatus, Snapshot } from '../server/task-types'
import {
  acknowledge,
  canAcknowledge,
  canStartWrite,
  clearReconciliation,
  needsReconciliation,
  requireReconciliation,
  reviewActive,
  reviewArchived,
} from './archive-reconciliation'

const snapshot: Snapshot = {
  tasks: [],
  projects: [],
  refreshedAt: 1,
  error: null,
}

describe('archive reconciliation gate', () => {
  it.each(['partial', 'uncertain', 'stale', 'busy'] as ArchiveStatus[])(
    'blocks a subsequent write after %s until both lists are reviewed and acknowledged',
    (status) => {
      const write = vi.fn()
      let state = needsReconciliation(status)
        ? requireReconciliation()
        : clearReconciliation
      if (canStartWrite(state, false)) write()
      expect(write).not.toHaveBeenCalled()
      state = reviewActive(state, snapshot)
      expect(canAcknowledge(state)).toBe(false)
      state = reviewArchived(state)
      expect(canStartWrite(state, false)).toBe(false)
      state = acknowledge(state)
      if (canStartWrite(state, false)) write()
      expect(write).toHaveBeenCalledOnce()
    },
  )

  it('keeps a lost-response write locked through failed refreshes', () => {
    const write = vi.fn()
    let state = requireReconciliation()
    state = reviewActive(state, { ...snapshot, error: 'read failed' })
    state = reviewArchived(state)
    state = acknowledge(state)
    if (canStartWrite(state, false)) write()
    expect(write).not.toHaveBeenCalled()
    state = reviewActive(state, snapshot)
    state = acknowledge(state)
    if (canStartWrite(state, false)) write()
    expect(write).toHaveBeenCalledOnce()
  })
})
