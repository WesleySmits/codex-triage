import { useState } from 'react'

import {
  archiveAutomationGroup,
  archiveTask,
  getArchivedTasks,
  unarchiveTask,
} from '../server/functions'
import type { ExpectedTask, Snapshot } from '../server/task-types'
import { executeArchive } from './archive-command'
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
  const [error, setError] = useState<string | null>(null)
  const archivedList = useArchivedTasks(busy, setError)

  async function confirm() {
    if (!pending || busy) return
    const target = pending
    setBusy(true)
    setError(null)
    setPending(null)
    try {
      const result = await executeArchive(target, {
        archiveTask: (task) => archiveTask({ data: task }),
        restoreTask: (task) => unarchiveTask({ data: task }),
        archiveGroup: (automationId, tasks) =>
          archiveAutomationGroup({ data: { automationId, tasks } }),
      })
      onSnapshot(result.snapshot)
      setReceipt({ target, result })
      archivedList.invalidate()
    } catch (cause) {
      // A lost response may follow a write. Keep the target out of the retry path.
      setReceipt(null)
      setError(message(cause))
    } finally {
      setBusy(false)
    }
  }

  function request(target: ArchiveTarget) {
    if (busy) return
    setPending(target)
    setReceipt(null)
    setError(null)
  }

  function reviewRemaining() {
    if (busy || !receipt) return
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
    request,
    cancel: () => {
      setPending(null)
    },
    confirm,
    reviewRemaining,
    loadArchived: archivedList.load,
  }
}

function useArchivedTasks(
  busy: boolean,
  setError: (error: string | null) => void,
) {
  const [archived, setArchived] = useState<ExpectedTask[]>([])
  const [loaded, setLoaded] = useState(false)
  async function load() {
    if (busy) return
    try {
      setArchived(await getArchivedTasks())
      setLoaded(true)
      setError(null)
    } catch (cause) {
      setError(message(cause))
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
