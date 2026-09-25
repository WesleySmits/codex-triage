import type { ArchiveResult } from '../server/task-types'
import {
  clearReconciliation,
  type Reconciliation,
  requireReconciliation,
} from './archive-reconciliation'

export const ARCHIVE_SENTINEL_KEY = 'codex-triage-archive-pending-v1'
export const ARCHIVE_STORAGE_LOCKED = 'archive-storage-locked'
export const ARCHIVE_EXTERNAL_PENDING = 'archive-external-pending'

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
  marker: string | null
} {
  if (!storage)
    return {
      reconciliation: requireReconciliation(),
      storageLocked: true,
      marker: null,
    }
  try {
    const marker = storage.getItem(ARCHIVE_SENTINEL_KEY)
    return {
      reconciliation:
        marker === null ? clearReconciliation : requireReconciliation(),
      storageLocked: false,
      marker,
    }
  } catch {
    return {
      reconciliation: requireReconciliation(),
      storageLocked: true,
      marker: null,
    }
  }
}

/** A cross-tab write invalidates reviews taken before that write settled. */
export function reconcileArchiveStorageEvent(
  current: Reconciliation,
  storage: ArchiveStorage | null,
  event: Pick<StorageEvent, 'key' | 'newValue'>,
): { reconciliation: Reconciliation; marker: string | null } {
  if (event.key !== ARCHIVE_SENTINEL_KEY && event.key !== null)
    return { reconciliation: current, marker: null }
  const restored = restoreArchiveLock(storage)
  return {
    reconciliation: requireReconciliation(),
    marker: restored.marker,
  }
}

/** A reviewed marker must still match, and the server must be idle. */
export function mayAcknowledgeArchiveMarker(
  storage: ArchiveStorage | null,
  reviewedMarker: string | null,
  serverBusy: boolean,
): boolean {
  if (!storage || serverBusy) return false
  try {
    return storage.getItem(ARCHIVE_SENTINEL_KEY) === reviewedMarker
  } catch {
    return false
  }
}

/** Write and verify the sentinel synchronously before any provider mutation. */
export function markArchivePending(
  storage: ArchiveStorage | null,
): string | null {
  if (!storage) return null
  try {
    if (storage.getItem(ARCHIVE_SENTINEL_KEY) !== null) return null
    const marker = `pending:${globalThis.crypto.randomUUID()}`
    storage.setItem(ARCHIVE_SENTINEL_KEY, marker)
    return storage.getItem(ARCHIVE_SENTINEL_KEY) === marker ? marker : null
  } catch {
    return null
  }
}

/** Only a verified result or acknowledged reconciliation may clear the lock. */
export function clearArchivePending(
  storage: ArchiveStorage | null,
  expectedMarker: string | null,
): boolean {
  if (!storage) return false
  try {
    if (storage.getItem(ARCHIVE_SENTINEL_KEY) !== expectedMarker) return false
    if (expectedMarker === null) return true
    storage.removeItem(ARCHIVE_SENTINEL_KEY)
    return storage.getItem(ARCHIVE_SENTINEL_KEY) === null
  } catch {
    return false
  }
}

export function settleArchiveResult(
  storage: ArchiveStorage | null,
  result: ArchiveResult,
  marker: string,
): boolean {
  if (result.status !== 'complete' && result.status !== 'continue') return false
  if (result.snapshot.error) return false
  return clearArchivePending(storage, marker)
}
