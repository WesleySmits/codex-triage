import type { Dispatch, RefObject, SetStateAction } from 'react'

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
  readServerBusy: () => Promise<boolean>
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
    const serverBusy = await readServerBusy()
    if (serverBusy) {
      setError(ARCHIVE_EXTERNAL_PENDING)
      change(requireReconciliation())
      return
    }
    const currentStorage = storage()
    if (
      marker.current !== reviewedMarker ||
      !canAcknowledge(state.current) ||
      !mayAcknowledgeArchiveMarker(
        currentStorage,
        reviewedMarker,
        serverBusy,
      ) ||
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
