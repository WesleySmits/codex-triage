import type { Dispatch, RefObject, SetStateAction } from 'react'

import type { ArchiveMutationStatus } from '../server/task-types'
import {
  ARCHIVE_EXTERNAL_PENDING,
  ARCHIVE_STORAGE_LOCKED,
  type ArchiveStorage,
  clearArchivePending,
  mayAcknowledgeArchiveMarker,
} from './archive-persistence'
import {
  acknowledge,
  canAcknowledge,
  type Reconciliation,
  requireReconciliation,
} from './archive-reconciliation'

interface AcknowledgmentContext {
  busy: RefObject<boolean>
  acknowledging: RefObject<boolean>
  state: RefObject<Reconciliation>
  marker: RefObject<string | null>
  readServerBusy: () => Promise<ArchiveMutationStatus>
  storage: () => ArchiveStorage | null
  setAcknowledging: Dispatch<SetStateAction<boolean>>
  setError: Dispatch<SetStateAction<string | null>>
  change: (next: Reconciliation) => void
}

/** Only a fresh review and an idle server may release the reviewed marker. */
export async function acknowledgeArchive({
  busy,
  acknowledging,
  state,
  marker,
  readServerBusy,
  storage,
  setAcknowledging,
  setError,
  change,
}: AcknowledgmentContext): Promise<void> {
  if (busy.current || acknowledging.current || !canAcknowledge(state.current))
    return
  acknowledging.current = true
  setAcknowledging(true)
  const reviewedMarker = marker.current
  try {
    const serverStatus = await readServerBusy()
    if (!reviewMatchesServer(state.current, serverStatus)) {
      setError(ARCHIVE_EXTERNAL_PENDING)
      change(requireReconciliation())
      return
    }
    const currentStorage = storage()
    if (
      !canClearReviewedMarker({
        state: state.current,
        currentMarker: marker.current,
        reviewedMarker,
        storage: currentStorage,
        server: serverStatus,
      }) ||
      !clearArchivePending(currentStorage, reviewedMarker)
    ) {
      setError(ARCHIVE_STORAGE_LOCKED)
      change(requireReconciliation())
      return
    }
    marker.current = null
    change(acknowledge(state.current))
    setError(null)
  } catch {
    setError(ARCHIVE_STORAGE_LOCKED)
    change(requireReconciliation())
  } finally {
    acknowledging.current = false
    setAcknowledging(false)
  }
}

function reviewMatchesServer(
  state: Reconciliation,
  server: ArchiveMutationStatus,
): boolean {
  return !server.busy && state.reviewVersion === server.version
}

function canClearReviewedMarker({
  state,
  currentMarker,
  reviewedMarker,
  storage,
  server,
}: {
  state: Reconciliation
  currentMarker: string | null
  reviewedMarker: string | null
  storage: ArchiveStorage | null
  server: ArchiveMutationStatus
}): boolean {
  return (
    currentMarker === reviewedMarker &&
    canAcknowledge(state) &&
    mayAcknowledgeArchiveMarker(storage, reviewedMarker, server.busy)
  )
}
