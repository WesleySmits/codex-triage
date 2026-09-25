import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from 'react'

import {
  archiveAutomationGroup,
  archiveSelectedTasks,
  archiveTask,
  getArchivedTasks,
  getArchiveMutationStatus,
  unarchiveTask,
} from '../server/functions'
import type {
  ArchiveResult,
  ExpectedTask,
  Snapshot,
} from '../server/task-types'
import { acknowledgeArchive } from './archive-acknowledgment'
import { executeArchive } from './archive-command'
import {
  ARCHIVE_STORAGE_LOCKED,
  browserArchiveStorage,
  markArchivePending,
  settleArchiveResult,
} from './archive-persistence'
import {
  canAcknowledge,
  canStartWrite,
  type Reconciliation,
  requireReconciliation,
  reviewActive,
  reviewArchived,
  verifiedReviewVersion,
} from './archive-reconciliation'
import {
  type ArchiveReceipt,
  type ArchiveTarget,
  remainingGroup,
  remainingSelection,
} from './archive-review'
import { usePersistentArchiveLock } from './use-persistent-archive-lock'

export interface ArchiveControls {
  pending: ArchiveTarget | null
  receipt: ArchiveReceipt | null
  busy: boolean
  error: string | null
  archived: ExpectedTask[]
  archivedLoaded: boolean
  reconciliation: Reconciliation
  storageChecked: boolean
  canAcknowledge: boolean
  acknowledgeReconciliation: () => Promise<void>
  reviewedActiveSnapshot: (snapshot: Snapshot, version: string | null) => void
  request: (target: ArchiveTarget) => void
  cancel: () => void
  confirm: () => Promise<void>
  reviewRemaining: () => void
  loadArchived: () => Promise<void>
}

export function useArchiveActions(
  onSnapshot: (snapshot: Snapshot) => void,
): ArchiveControls {
  const [pending, setPending] = useState<ArchiveTarget | null>(null)
  const [receipt, setReceipt] = useState<ArchiveReceipt | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const reconciliation = useArchiveReconciliation(busyRef, setError)
  const archiveLock = usePersistentArchiveLock(
    reconciliation,
    setError,
    setPending,
  )
  const archivedList = useArchivedReview(busyRef, setError, reconciliation)

  function request(target: ArchiveTarget) {
    if (!canStartWrite(reconciliation.current.current, busyRef.current)) return
    setPending(target)
    setReceipt(null)
    setError(null)
  }

  function reviewRemaining() {
    if (busyRef.current || !receipt) return
    const next = remainingGroup(receipt) ?? remainingSelection(receipt)
    if (next) request(next)
  }

  return {
    pending,
    receipt,
    busy,
    error,
    archived: archivedList.archived,
    archivedLoaded: archivedList.loaded,
    reconciliation: reconciliation.state,
    storageChecked: archiveLock.storageChecked,
    canAcknowledge: reconciliation.canAcknowledge,
    acknowledgeReconciliation: reconciliation.acknowledge,
    reviewedActiveSnapshot: reconciliation.reviewActive,
    request,
    cancel: () => {
      setPending(null)
    },
    confirm: () =>
      confirmArchive({
        pending,
        busyRef,
        mountedRef: archiveLock.mountedRef,
        reconciliation,
        onSnapshot,
        invalidate: archivedList.invalidate,
        setPending,
        setBusy,
        setError,
        setReceipt,
      }),
    reviewRemaining,
    loadArchived: archivedList.load,
  }
}

function useArchivedReview(
  busyRef: RefObject<boolean>,
  setError: Dispatch<SetStateAction<string | null>>,
  reconciliation: ReturnType<typeof useArchiveReconciliation>,
) {
  return useArchivedTasks(
    busyRef,
    setError,
    () => reconciliation.current.current.required,
    (version) => {
      if (version) reconciliation.reviewArchived(version)
    },
  )
}

interface ConfirmationContext {
  pending: ArchiveTarget | null
  busyRef: RefObject<boolean>
  mountedRef: RefObject<boolean>
  reconciliation: ReturnType<typeof useArchiveReconciliation>
  onSnapshot: (snapshot: Snapshot) => void
  invalidate: () => void
  setPending: (target: ArchiveTarget | null) => void
  setBusy: (busy: boolean) => void
  setError: (error: string | null) => void
  setReceipt: (receipt: ArchiveReceipt) => void
}

async function confirmArchive(context: ConfirmationContext): Promise<void> {
  const started = beginArchive(context)
  if (!started) return
  try {
    const result = await executeArchive(started.target, {
      archiveTask: (task) => archiveTask({ data: task }),
      restoreTask: (task) => unarchiveTask({ data: task }),
      archiveGroup: (automationId, tasks) =>
        archiveAutomationGroup({ data: { automationId, tasks } }),
      archiveSelection: (tasks) => archiveSelectedTasks({ data: tasks }),
    })
    if (context.mountedRef.current)
      applyArchiveResult(context, started.target, result, started.marker)
  } catch (cause) {
    // A lost response may follow a write. Keep the target out of the retry path.
    context.setError(message(cause))
    context.reconciliation.require()
  } finally {
    context.busyRef.current = false
    context.setBusy(false)
  }
}

function beginArchive(
  context: ConfirmationContext,
): { target: ArchiveTarget; marker: string } | null {
  const { pending, busyRef, reconciliation } = context
  if (
    !pending ||
    !canStartWrite(reconciliation.current.current, busyRef.current)
  )
    return null
  const marker = markArchivePending(browserArchiveStorage())
  if (!marker) {
    context.setPending(null)
    context.setError(ARCHIVE_STORAGE_LOCKED)
    reconciliation.require()
    return null
  }
  busyRef.current = true
  reconciliation.marker.current = marker
  context.setBusy(true)
  context.setError(null)
  context.setPending(null)
  return { target: pending, marker }
}

function applyArchiveResult(
  context: ConfirmationContext,
  target: ArchiveTarget,
  result: ArchiveResult,
  marker: string,
) {
  context.onSnapshot(result.snapshot)
  context.setReceipt({ target, result })
  context.invalidate()
  if (!settleArchiveResult(browserArchiveStorage(), result, marker))
    context.reconciliation.require()
  else context.reconciliation.marker.current = null
}

function useArchiveReconciliation(
  busyRef: RefObject<boolean>,
  setError: Dispatch<SetStateAction<string | null>>,
) {
  const [state, setState] = useState(requireReconciliation)
  const stateRef = useRef(state)
  const markerRef = useRef<string | null>(null)
  const acknowledgingRef = useRef(false)
  const [acknowledging, setAcknowledging] = useState(false)
  const change = useCallback((next: Reconciliation) => {
    stateRef.current = next
    setState(next)
  }, [])
  return {
    state,
    current: stateRef,
    marker: markerRef,
    change,
    canAcknowledge: canAcknowledge(state) && !acknowledging,
    require: () => {
      change(requireReconciliation())
    },
    reviewArchived: (version: string) => {
      change(reviewArchived(stateRef.current, version))
    },
    reviewActive: (snapshot: Snapshot, version: string | null) => {
      change(reviewActive(stateRef.current, snapshot, version))
    },
    acknowledge: () =>
      acknowledgeArchive({
        busy: busyRef,
        acknowledging: acknowledgingRef,
        state: stateRef,
        marker: markerRef,
        readServerBusy: () => getArchiveMutationStatus(),
        storage: browserArchiveStorage,
        setAcknowledging,
        setError,
        change,
      }),
  }
}

function useArchivedTasks(
  busyRef: RefObject<boolean>,
  setError: Dispatch<SetStateAction<string | null>>,
  requiresReview: () => boolean,
  onLoaded: (version: string | null) => void,
) {
  const [archived, setArchived] = useState<ExpectedTask[]>([])
  const [loaded, setLoaded] = useState(false)
  async function load() {
    if (busyRef.current) return
    const startedForReview = requiresReview()
    try {
      const before = startedForReview ? await getArchiveMutationStatus() : null
      const tasks = await getArchivedTasks()
      const after = startedForReview ? await getArchiveMutationStatus() : null
      setArchived(tasks)
      setLoaded(true)
      onLoaded(verifiedReviewVersion(before, after))
    } catch (cause) {
      setError((previous) => previous ?? message(cause))
    }
  }
  return {
    archived,
    loaded,
    load,
    invalidate: () => {
      setLoaded(false)
    },
  }
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
