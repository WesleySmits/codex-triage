import { describe, expect, it, vi } from 'vitest'

import {
  ARCHIVE_SENTINEL_KEY,
  type ArchiveStorage,
  clearArchivePending,
  hasPendingArchive,
  markArchivePending,
  mayAcknowledgeArchiveMarker,
  reconcileArchiveStorageEvent,
  restoreArchiveLock,
  restoredReconciliation,
  settleArchiveResult,
} from './archive-persistence'
import {
  acknowledge,
  canAcknowledge,
  canStartWrite,
  clearReconciliation,
  requireReconciliation,
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

function pendingMarker(saved: ArchiveStorage): string {
  const marker = markArchivePending(saved)
  if (!marker) throw new Error('Synthetic marker was not written')
  return marker
}

const activeSnapshot = {
  tasks: [],
  projects: [],
  refreshedAt: 1,
  error: null,
}

describe('cross-tab archive events', () => {
  it('does not release a marker found on mount while the server write is live', () => {
    const shared = storage()
    const ownerMarker = pendingMarker(shared)
    const openedTab = restoreArchiveLock(shared)
    expect(openedTab.marker).toBe(ownerMarker)
    expect(mayAcknowledgeArchiveMarker(shared, openedTab.marker, true)).toBe(
      false,
    )
    expect(hasPendingArchive(shared)).toBe(true)
  })

  it('refuses to clear a marker replaced while acknowledgment was checking server status', () => {
    const shared = storage()
    const reviewedMarker = pendingMarker(shared)
    shared.setItem(ARCHIVE_SENTINEL_KEY, 'pending:replacement')
    expect(mayAcknowledgeArchiveMarker(shared, reviewedMarker, false)).toBe(
      false,
    )
    expect(clearArchivePending(shared, reviewedMarker)).toBe(false)
    expect(shared.getItem(ARCHIVE_SENTINEL_KEY)).toBe('pending:replacement')
  })
})

describe('cross-tab archive events', () => {
  it('requires a fresh review after another tab clears a pending marker', () => {
    const saved = storage()
    const marker = pendingMarker(saved)
    let change = reconcileArchiveStorageEvent(clearReconciliation, saved, {
      key: ARCHIVE_SENTINEL_KEY,
      newValue: marker,
    })
    expect(change.marker).toBe(marker)
    let state = reviewArchived(
      reviewActive(change.reconciliation, activeSnapshot, 'reviewed'),
      'reviewed',
    )
    expect(canAcknowledge(state)).toBe(true)
    expect(mayAcknowledgeArchiveMarker(saved, change.marker, true)).toBe(false)
    expect(clearArchivePending(saved, marker)).toBe(true)
    change = reconcileArchiveStorageEvent(state, saved, {
      key: ARCHIVE_SENTINEL_KEY,
      newValue: null,
    })
    expect(change.marker).toBeNull()
    expect(canAcknowledge(change.reconciliation)).toBe(false)
    state = reviewArchived(
      reviewActive(change.reconciliation, activeSnapshot, 'reviewed'),
      'reviewed',
    )
    expect(canAcknowledge(state)).toBe(true)
    expect(mayAcknowledgeArchiveMarker(saved, change.marker, false)).toBe(true)
  })

  it('locks on another tab starting an archive, while unrelated storage changes do nothing', () => {
    const saved = storage()
    let change = reconcileArchiveStorageEvent(clearReconciliation, saved, {
      key: 'codex-triage-language',
      newValue: 'nl',
    })
    expect(change.reconciliation.required).toBe(false)
    const marker = pendingMarker(saved)
    change = reconcileArchiveStorageEvent(change.reconciliation, saved, {
      key: ARCHIVE_SENTINEL_KEY,
      newValue: marker,
    })
    expect(change.reconciliation).toEqual(requireReconciliation())
  })
})

describe('archive persistence', () => {
  it('keeps uncertain and in-flight calls locked after reload until review', () => {
    for (const outcome of ['uncertain response', 'unload in flight']) {
      const saved = storage()
      const marker = pendingMarker(saved)
      expect(hasPendingArchive(saved)).toBe(true)
      let state = restoredReconciliation(saved) // New page hydrates from the sentinel.
      const write = vi.fn()
      if (canStartWrite(state, false)) write()
      expect(write, outcome).not.toHaveBeenCalled()
      state = reviewActive(state, activeSnapshot, 'reviewed')
      state = reviewArchived(state, 'reviewed')
      expect(canStartWrite(state, false)).toBe(false)
      expect(clearArchivePending(saved, marker)).toBe(true)
      state = acknowledge(state)
      expect(canStartWrite(state, false)).toBe(true)
      expect(hasPendingArchive(saved)).toBe(false)
    }
  })

  it('clears the marker after verified completion or continuation', () => {
    const saved = storage()
    for (const status of ['complete', 'continue'] as const) {
      const marker = pendingMarker(saved)
      expect(
        settleArchiveResult(
          saved,
          { status, confirmedIds: [], snapshot: activeSnapshot },
          marker,
        ),
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
      const marker = pendingMarker(saved)
      expect(
        settleArchiveResult(
          saved,
          { status, confirmedIds: [], snapshot: activeSnapshot },
          marker,
        ),
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
    expect(markArchivePending(null)).toBeNull()
    expect(hasPendingArchive(broken)).toBe(true)
    expect(markArchivePending(broken)).toBeNull()
    expect(write).not.toHaveBeenCalled()
    const saved = storage()
    saved.setItem(ARCHIVE_SENTINEL_KEY, 'pending')
    expect(markArchivePending(saved)).toBeNull()
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
