import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useRef,
  useState,
} from 'react'

import {
  archiveAutomationGroup,
  archiveTask,
  getArchivedTasks,
  unarchiveTask,
} from '../server/functions'
import type {
  ArchiveResult,
  ExpectedTask,
  Snapshot,
} from '../server/task-types'
import { executeArchive } from './archive-command'
import {
  acknowledge,
  canAcknowledge,
  canStartWrite,
  clearReconciliation,
  needsReconciliation,
  type Reconciliation,
  requireReconciliation,
  reviewActive,
  reviewArchived,
} from './archive-reconciliation'
import {
  type ArchiveReceipt,
  type ArchiveTarget,
  remainingGroup,
} from './archive-review'

export interface ArchiveControls {
  pending: ArchiveTarget | null
  receipt: ArchiveReceipt | null
  busy: boolean
  error: string | null
  archived: ExpectedTask[]
  archivedLoaded: boolean
  reconciliation: Reconciliation
  canAcknowledge: boolean
  acknowledgeReconciliation: () => void
  reviewedActiveSnapshot: (snapshot: Snapshot) => void
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
  const reconciliation = useArchiveReconciliation(busyRef)
  const archivedList = useArchivedTasks(
    busyRef,
    setError,
    () => reconciliation.current.current.required,
    (startedForReview) => {
      if (startedForReview) reconciliation.reviewArchived()
    },
  )

  function request(target: ArchiveTarget) {
    if (!canStartWrite(reconciliation.current.current, busyRef.current)) return
    setPending(target)
    setReceipt(null)
    setError(null)
  }

  function reviewRemaining() {
    if (busyRef.current || !receipt) return
    const next = remainingGroup(receipt)
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

interface ConfirmationContext {
  pending: ArchiveTarget | null
  busyRef: RefObject<boolean>
  reconciliation: ReturnType<typeof useArchiveReconciliation>
  onSnapshot: (snapshot: Snapshot) => void
  invalidate: () => void
  setPending: (target: ArchiveTarget | null) => void
  setBusy: (busy: boolean) => void
  setError: (error: string | null) => void
  setReceipt: (receipt: ArchiveReceipt) => void
}

async function confirmArchive(context: ConfirmationContext): Promise<void> {
  const { pending, busyRef, reconciliation } = context
  if (
    !pending ||
    !canStartWrite(reconciliation.current.current, busyRef.current)
  )
    return
  busyRef.current = true
  context.setBusy(true)
  context.setError(null)
  context.setPending(null)
  try {
    const result = await executeArchive(pending, {
      archiveTask: (task) => archiveTask({ data: task }),
      restoreTask: (task) => unarchiveTask({ data: task }),
      archiveGroup: (automationId, tasks) =>
        archiveAutomationGroup({ data: { automationId, tasks } }),
    })
    applyArchiveResult(context, pending, result)
  } catch (cause) {
    // A lost response may follow a write. Keep the target out of the retry path.
    context.setError(message(cause))
    reconciliation.require()
  } finally {
    busyRef.current = false
    context.setBusy(false)
  }
}

function applyArchiveResult(
  context: ConfirmationContext,
  target: ArchiveTarget,
  result: ArchiveResult,
) {
  context.onSnapshot(result.snapshot)
  context.setReceipt({ target, result })
  context.invalidate()
  if (needsReconciliation(result.status) || result.snapshot.error)
    context.reconciliation.require()
}

function useArchiveReconciliation(busyRef: RefObject<boolean>) {
  const [state, setState] = useState(clearReconciliation)
  const stateRef = useRef(state)
  function change(next: Reconciliation) {
    stateRef.current = next
    setState(next)
  }
  return {
    state,
    current: stateRef,
    canAcknowledge: canAcknowledge(state),
    require: () => {
      change(requireReconciliation())
    },
    reviewArchived: () => {
      change(reviewArchived(stateRef.current))
    },
    reviewActive: (snapshot: Snapshot) => {
      change(reviewActive(stateRef.current, snapshot))
    },
    acknowledge: () => {
      if (!busyRef.current) change(acknowledge(stateRef.current))
    },
  }
}

function useArchivedTasks(
  busyRef: RefObject<boolean>,
  setError: Dispatch<SetStateAction<string | null>>,
  requiresReview: () => boolean,
  onLoaded: (startedForReview: boolean) => void,
) {
  const [archived, setArchived] = useState<ExpectedTask[]>([])
  const [loaded, setLoaded] = useState(false)
  async function load() {
    if (busyRef.current) return
    const startedForReview = requiresReview()
    try {
      setArchived(await getArchivedTasks())
      setLoaded(true)
      onLoaded(startedForReview)
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
