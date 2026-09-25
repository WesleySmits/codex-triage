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
  verifiedReviewVersion,
} from './archive-reconciliation'

const snapshot: Snapshot = {
  tasks: [],
  projects: [],
  refreshedAt: 1,
  error: null,
}

describe('archive reconciliation gate', () => {
  it('rejects a list read that spans a mutation or server restart', () => {
    expect(
      verifiedReviewVersion(
        { busy: false, version: 'before-write' },
        { busy: false, version: 'after-write' },
      ),
    ).toBeNull()
    expect(
      verifiedReviewVersion(
        { busy: true, version: 'during-write' },
        { busy: false, version: 'after-write' },
      ),
    ).toBeNull()
  })

  it('requires active and archived reviews from the same server version', () => {
    let state = reviewActive(requireReconciliation(), snapshot, 'before-write')
    state = reviewArchived(state, 'after-write')
    expect(canAcknowledge(state)).toBe(false)
    state = reviewActive(state, snapshot, 'after-write')
    expect(canAcknowledge(state)).toBe(true)
  })

  it.each(['partial', 'uncertain', 'stale', 'busy'] as ArchiveStatus[])(
    'blocks a subsequent write after %s until both lists are reviewed and acknowledged',
    (status) => {
      const write = vi.fn()
      let state = needsReconciliation(status)
        ? requireReconciliation()
        : clearReconciliation
      if (canStartWrite(state, false)) write()
      expect(write).not.toHaveBeenCalled()
      state = reviewActive(state, snapshot, 'reviewed')
      expect(canAcknowledge(state)).toBe(false)
      state = reviewArchived(state, 'reviewed')
      expect(canStartWrite(state, false)).toBe(false)
      state = acknowledge(state)
      if (canStartWrite(state, false)) write()
      expect(write).toHaveBeenCalledOnce()
    },
  )

  it('keeps a lost-response write locked through failed refreshes', () => {
    const write = vi.fn()
    let state = requireReconciliation()
    state = reviewActive(
      state,
      { ...snapshot, error: 'read failed' },
      'reviewed',
    )
    state = reviewArchived(state, 'reviewed')
    state = acknowledge(state)
    if (canStartWrite(state, false)) write()
    expect(write).not.toHaveBeenCalled()
    state = reviewActive(state, snapshot, 'reviewed')
    state = acknowledge(state)
    if (canStartWrite(state, false)) write()
    expect(write).toHaveBeenCalledOnce()
  })
})
