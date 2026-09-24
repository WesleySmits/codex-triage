import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'

import type { AnalysisProgress, AnalysisView } from '../server/analysis-types'
import {
  cancelAnalysis,
  getAnalyses,
  getAnalysisStatus,
  startAnalysis,
} from '../server/functions'
import type { Task } from '../server/task-types'
import { type AnalysisReadout, startAnalysisPolling } from './analysis-polling'
import {
  analysisRequestIds,
  availableSelection,
  toggleSelection,
} from './analysis-selection'

type Status = Awaited<ReturnType<typeof getAnalysisStatus>>
type Setter<T> = Dispatch<SetStateAction<T>>

interface AnalysisState {
  status: Status | null
  setStatus: Setter<Status | null>
  setViews: Setter<AnalysisView[]>
  setError: Setter<string | null>
  busy: boolean
  setBusy: Setter<boolean>
}

export interface AnalysisControls {
  status: Status | null
  views: AnalysisView[]
  selected: string[]
  busy: boolean
  error: string | null
  toggle: (id: string) => void
  clear: () => void
  start: () => Promise<void>
  cancel: () => Promise<void>
  reload: () => Promise<void>
}

export function useAnalysis(tasks: Task[]): AnalysisControls {
  const [status, setStatus] = useState<Status | null>(null)
  const [views, setViews] = useState<AnalysisView[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const state = { status, setStatus, setViews, setError, busy, setBusy }

  useEffect(() => {
    setSelected((current) => availableSelection(current, tasks))
  }, [tasks])

  useEffect(() => {
    void loadAnalysis(setStatus, setViews, setError)
  }, [setStatus, setViews, setError])

  useAnalysisPolling(state)
  const { start, cancel, reload } = useAnalysisActions(tasks, selected, state)

  return {
    status,
    views,
    selected,
    busy,
    error,
    toggle: (id) => {
      setSelected((current) => toggleSelection(current, id))
    },
    clear: () => {
      setSelected([])
    },
    start,
    cancel,
    reload,
  }
}

function useAnalysisPolling(state: AnalysisState) {
  const { status, setStatus, setViews, setError } = state
  useEffect(() => {
    if (status?.progress.status !== 'running') return
    return startAnalysisPolling({
      read: readAnalysis,
      onResult: (readout) => {
        setStatus(readout.status)
        setViews(readout.views)
      },
      onError: (cause) => {
        setError(errorMessage(cause))
      },
    })
  }, [status?.progress.status])
}

function useAnalysisActions(
  tasks: Task[],
  selected: string[],
  state: AnalysisState,
) {
  const { status, setStatus, setViews, setError, busy, setBusy } = state
  async function reload() {
    await loadAnalysis(setStatus, setViews, setError)
  }

  async function start() {
    if (!status) return
    const ids = analysisRequestIds(selected, tasks, status, busy)
    if (ids.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const progress: AnalysisProgress = await startAnalysis({ data: ids })
      setStatus({ ...status, progress })
    } catch (cause) {
      setError(errorMessage(cause))
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (status?.progress.status !== 'running') return
    setBusy(true)
    setError(null)
    try {
      const progress = await cancelAnalysis()
      setStatus({ ...status, progress })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return { start, cancel, reload }
}

async function readAnalysis(): Promise<AnalysisReadout> {
  const [status, views] = await Promise.all([
    getAnalysisStatus(),
    getAnalyses(),
  ])
  return { status, views }
}

async function loadAnalysis(
  setStatus: Setter<Status | null>,
  setViews: Setter<AnalysisView[]>,
  setError: Setter<string | null>,
): Promise<void> {
  try {
    const readout = await readAnalysis()
    setStatus(readout.status)
    setViews(readout.views)
  } catch (cause) {
    setError(errorMessage(cause))
  }
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
