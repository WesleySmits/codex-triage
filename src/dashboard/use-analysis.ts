import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'

import type { AnalysisProgress, AnalysisView } from '../server/analysis-types'
import {
  cancelAnalysis,
  getAnalyses,
  getAnalysisStatus,
  startAnalysis,
} from '../server/functions'
import type { Task } from '../server/task-types'
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
    void Promise.all([getAnalysisStatus(), getAnalyses()])
      .then(([nextStatus, nextViews]) => {
        setStatus(nextStatus)
        setViews(nextViews)
      })
      .catch((cause: unknown) => {
        setError(errorMessage(cause))
      })
  }, [])

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
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const next = await getAnalysisStatus()
        if (stopped) return
        setStatus(next)
        setViews(await getAnalyses())
        if (next.progress.status === 'running')
          timer = setTimeout(() => {
            void poll()
          }, 1000)
      } catch (cause) {
        setError(errorMessage(cause))
      }
    }
    timer = setTimeout(() => {
      void poll()
    }, 1000)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [status?.progress.status])
}

function useAnalysisActions(
  tasks: Task[],
  selected: string[],
  state: AnalysisState,
) {
  const { status, setStatus, setViews, setError, busy, setBusy } = state
  async function reload() {
    try {
      const [nextStatus, nextViews] = await Promise.all([
        getAnalysisStatus(),
        getAnalyses(),
      ])
      setStatus(nextStatus)
      setViews(nextViews)
    } catch (cause) {
      setError(errorMessage(cause))
    }
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

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
