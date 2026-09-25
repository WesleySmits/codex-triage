import { describe, expect, it, vi } from 'vitest'

import { acknowledgeArchive } from './archive-acknowledgment'
import {
  ARCHIVE_SENTINEL_KEY,
  type ArchiveStorage,
  markArchivePending,
} from './archive-persistence'
import { canAcknowledge, requireReconciliation } from './archive-reconciliation'

function storage(): ArchiveStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

function reviewedContext(
  saved: ArchiveStorage,
  readServerBusy: () => Promise<boolean>,
) {
  const marker = markArchivePending(saved)
  if (!marker) throw new Error('Synthetic marker was not written')
  const state = {
    current: { required: true, activeReviewed: true, archivedReviewed: true },
  }
  const error = vi.fn()
  return {
    marker,
    state,
    error,
    input: {
      busy: { current: false },
      acknowledging: { current: false },
      state,
      marker: { current: marker as string | null },
      readServerBusy,
      storage: () => saved,
      setAcknowledging: vi.fn(),
      setError: error,
      change: (next: typeof state.current) => {
        state.current = next
      },
    },
  }
}

describe('archive acknowledgment', () => {
  it('does not clear a marker found on mount while its server write is active', async () => {
    const saved = storage()
    const review = reviewedContext(saved, () => Promise.resolve(true))
    await acknowledgeArchive(review.input)
    expect(saved.getItem(ARCHIVE_SENTINEL_KEY)).toBe(review.marker)
    expect(review.state.current).toEqual(requireReconciliation())
  })

  it('does not clear a marker replaced during the server idle check', async () => {
    const saved = storage()
    let finishCheck: (busy: boolean) => void = () => undefined
    const check = new Promise<boolean>((resolve) => {
      finishCheck = resolve
    })
    const review = reviewedContext(saved, () => check)
    const acknowledgment = acknowledgeArchive(review.input)
    saved.setItem(ARCHIVE_SENTINEL_KEY, 'pending:replacement')
    finishCheck(false)
    await acknowledgment
    expect(saved.getItem(ARCHIVE_SENTINEL_KEY)).toBe('pending:replacement')
    expect(review.state.current).toEqual(requireReconciliation())
  })

  it('releases an orphaned marker after review and a confirmed idle server', async () => {
    const saved = storage()
    const review = reviewedContext(saved, () => Promise.resolve(false))
    await acknowledgeArchive(review.input)
    expect(saved.getItem(ARCHIVE_SENTINEL_KEY)).toBeNull()
    expect(canAcknowledge(review.state.current)).toBe(false)
    expect(review.state.current.required).toBe(false)
  })
})
