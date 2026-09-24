import { describe, expect, it, vi } from 'vitest'

import {
  ARCHIVE_SENTINEL_KEY,
  type ArchiveStorage,
  clearArchivePending,
  hasPendingArchive,
  markArchivePending,
  restoreArchiveLock,
  restoredReconciliation,
  settleArchiveResult,
} from './archive-persistence'
import {
  acknowledge,
  canStartWrite,
  reviewActive,
  reviewArchived,
} from './archive-reconciliation'

function storage(): ArchiveStorage {
  const entries = new Map<string, string>()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value)
    },
    removeItem: (key) => {
      entries.delete(key)
    },
  }
}

const activeSnapshot = {
  tasks: [],
  projects: [],
  refreshedAt: 1,
  error: null,
}

describe('archive persistence', () => {
  it('keeps uncertain and in-flight calls locked after reload until review', () => {
    for (const outcome of ['uncertain response', 'unload in flight']) {
      const saved = storage()
      expect(markArchivePending(saved)).toBe(true)
      expect(hasPendingArchive(saved)).toBe(true)
      let state = restoredReconciliation(saved) // New page hydrates from the sentinel.
      const write = vi.fn()
      if (canStartWrite(state, false)) write()
      expect(write, outcome).not.toHaveBeenCalled()
      state = reviewActive(state, activeSnapshot)
      state = reviewArchived(state)
      expect(canStartWrite(state, false)).toBe(false)
      expect(clearArchivePending(saved)).toBe(true)
      state = acknowledge(state)
      expect(canStartWrite(state, false)).toBe(true)
      expect(hasPendingArchive(saved)).toBe(false)
    }
  })

  it('clears the marker after verified completion or continuation', () => {
    const saved = storage()
    for (const status of ['complete', 'continue'] as const) {
      expect(markArchivePending(saved)).toBe(true)
      expect(
        settleArchiveResult(saved, {
          status,
          confirmedIds: [],
          snapshot: activeSnapshot,
        }),
      ).toBe(true)
      expect(hasPendingArchive(saved)).toBe(false)
    }
  })
})

describe('archive marker failures', () => {
  it.each(['partial', 'uncertain', 'stale', 'busy'] as const)(
    'keeps the marker after %s',
    (status) => {
      const saved = storage()
      expect(markArchivePending(saved)).toBe(true)
      expect(
        settleArchiveResult(saved, {
          status,
          confirmedIds: [],
          snapshot: activeSnapshot,
        }),
      ).toBe(false)
      expect(restoredReconciliation(saved).required).toBe(true)
    },
  )

  it('fails closed when storage is missing, throwing, or already locked', () => {
    const write = vi.fn()
    const broken: ArchiveStorage = {
      getItem: () => {
        throw new Error('storage unavailable')
      },
      setItem: write,
      removeItem: vi.fn(),
    }
    expect(hasPendingArchive(null)).toBe(true)
    expect(markArchivePending(null)).toBe(false)
    expect(hasPendingArchive(broken)).toBe(true)
    expect(markArchivePending(broken)).toBe(false)
    expect(write).not.toHaveBeenCalled()
    const saved = storage()
    saved.setItem(ARCHIVE_SENTINEL_KEY, 'pending')
    expect(markArchivePending(saved)).toBe(false)
    expect(restoredReconciliation(saved).required).toBe(true)
    expect(restoredReconciliation(broken).required).toBe(true)
    const blocked = restoreArchiveLock(broken)
    expect(blocked.storageLocked).toBe(true)
    expect(blocked.reconciliation.required).toBe(true)
    const pending = restoreArchiveLock(saved)
    expect(pending.storageLocked).toBe(false)
    expect(pending.reconciliation.required).toBe(true)
    const clear = restoreArchiveLock(storage())
    expect(clear.storageLocked).toBe(false)
    expect(clear.reconciliation.required).toBe(false)
  })

  it('does not start a duplicate provider write while a marker exists', () => {
    const saved = storage()
    const write = vi.fn()
    if (markArchivePending(saved)) write()
    if (markArchivePending(saved)) write()
    expect(write).toHaveBeenCalledOnce()
    expect(hasPendingArchive(saved)).toBe(true)
  })
})
