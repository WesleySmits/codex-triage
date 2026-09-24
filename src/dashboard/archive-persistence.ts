import type { ArchiveResult } from '../server/task-types'
import {
  clearReconciliation,
  type Reconciliation,
  requireReconciliation,
} from './archive-reconciliation'

export const ARCHIVE_SENTINEL_KEY = 'codex-triage-archive-pending-v1'
export const ARCHIVE_STORAGE_LOCKED = 'archive-storage-locked'

export interface ArchiveStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function browserArchiveStorage(): ArchiveStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Unknown storage state is treated as an unresolved archive action. */
export function hasPendingArchive(storage: ArchiveStorage | null): boolean {
  if (!storage) return true
  try {
    return storage.getItem(ARCHIVE_SENTINEL_KEY) !== null
  } catch {
    return true
  }
}

export function restoredReconciliation(
  storage: ArchiveStorage | null,
): Reconciliation {
  return restoreArchiveLock(storage).reconciliation
}

/** Distinguish an unresolved write from storage that cannot be read. */
export function restoreArchiveLock(storage: ArchiveStorage | null): {
  reconciliation: Reconciliation
  storageLocked: boolean
} {
  if (!storage)
    return { reconciliation: requireReconciliation(), storageLocked: true }
  try {
    return {
      reconciliation:
        storage.getItem(ARCHIVE_SENTINEL_KEY) === null
          ? clearReconciliation
          : requireReconciliation(),
      storageLocked: false,
    }
  } catch {
    return { reconciliation: requireReconciliation(), storageLocked: true }
  }
}

/** Write and verify the sentinel synchronously before any provider mutation. */
export function markArchivePending(storage: ArchiveStorage | null): boolean {
  if (!storage) return false
  try {
    if (storage.getItem(ARCHIVE_SENTINEL_KEY) !== null) return false
    storage.setItem(ARCHIVE_SENTINEL_KEY, 'pending')
    return storage.getItem(ARCHIVE_SENTINEL_KEY) === 'pending'
  } catch {
    return false
  }
}

/** Only a verified result or acknowledged reconciliation may clear the lock. */
export function clearArchivePending(storage: ArchiveStorage | null): boolean {
  if (!storage) return false
  try {
    storage.removeItem(ARCHIVE_SENTINEL_KEY)
    return storage.getItem(ARCHIVE_SENTINEL_KEY) === null
  } catch {
    return false
  }
}

export function settleArchiveResult(
  storage: ArchiveStorage | null,
  result: ArchiveResult,
): boolean {
  if (result.status !== 'complete' && result.status !== 'continue') return false
  if (result.snapshot.error) return false
  return clearArchivePending(storage)
}
