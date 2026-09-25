import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  ARCHIVE_EXTERNAL_PENDING,
  ARCHIVE_SENTINEL_KEY,
  ARCHIVE_STORAGE_LOCKED,
  browserArchiveStorage,
  reconcileArchiveStorageEvent,
  restoreArchiveLock,
} from './archive-persistence'
import type { Reconciliation } from './archive-reconciliation'
import type { ArchiveTarget } from './archive-review'

interface LockReconciliation {
  change: (next: Reconciliation) => void
  current: RefObject<Reconciliation>
  marker: RefObject<string | null>
}

export function usePersistentArchiveLock(
  reconciliation: LockReconciliation,
  setError: Dispatch<SetStateAction<string | null>>,
  setPending: (target: ArchiveTarget | null) => void,
) {
  const { change, current, marker } = reconciliation
  const mountedRef = useRef(false)
  const [storageChecked, setStorageChecked] = useState(false)
  useEffect(() => {
    mountedRef.current = true
    const storage = browserArchiveStorage()
    const restored = restoreArchiveLock(storage)
    marker.current = restored.marker
    change(restored.reconciliation)
    if (restored.storageLocked) setError(ARCHIVE_STORAGE_LOCKED)
    setStorageChecked(true)
    function onStorage(event: StorageEvent) {
      if (event.key !== ARCHIVE_SENTINEL_KEY && event.key !== null) return
      setPending(null)
      const changed = reconcileArchiveStorageEvent(
        current.current,
        browserArchiveStorage(),
        event,
      )
      marker.current = changed.marker
      change(changed.reconciliation)
      if (changed.marker === null)
        setError((previous) =>
          previous === ARCHIVE_EXTERNAL_PENDING ? null : previous,
        )
    }
    window.addEventListener('storage', onStorage)
    return () => {
      mountedRef.current = false
      window.removeEventListener('storage', onStorage)
    }
  }, [change, current, marker, setError, setPending])
  return { mountedRef, storageChecked }
}
