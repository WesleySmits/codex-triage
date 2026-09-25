import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { verifiedReviewVersion } from '../dashboard/archive-reconciliation'
import { DashboardView } from '../dashboard/dashboard-view'
import type { Language } from '../dashboard/i18n'
import { useAnalysis } from '../dashboard/use-analysis'
import { useArchiveActions } from '../dashboard/use-archive-actions'
import {
  getArchiveMutationStatus,
  getTaskSnapshot,
  refreshTaskSnapshot,
} from '../server/functions'
import type { Snapshot } from '../server/task-types'

export const Route = createFileRoute('/')({
  loader: () => getTaskSnapshot(),
  component: Dashboard,
})

function Dashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot>(Route.useLoaderData())
  const [language, setLanguage] = useState<Language>('en')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const analysis = useAnalysis(snapshot.tasks)
  const archive = useArchiveActions(setSnapshot)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLanguage(readLanguage())
    })
    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [])
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  function changeLanguage(next: Language) {
    setLanguage(next)
    try {
      window.localStorage.setItem('codex-triage-language', next)
    } catch {
      /* Current selection still works without storage. */
    }
  }

  async function refresh() {
    const startedForReview = archive.reconciliation.required
    setRefreshing(true)
    setRefreshFailed(false)
    try {
      const { fresh, version } = await loadActiveReview(startedForReview)
      setSnapshot(fresh)
      if (startedForReview) archive.reviewedActiveSnapshot(fresh, version)
      await analysis.reload()
    } catch {
      setRefreshFailed(true)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <DashboardView
      snapshot={snapshot}
      language={language}
      onLanguageChange={changeLanguage}
      onRefresh={() => {
        void refresh()
      }}
      refreshing={refreshing}
      refreshFailed={refreshFailed}
      analysis={analysis}
      archive={archive}
    />
  )
}

async function loadActiveReview(startedForReview: boolean) {
  const before = startedForReview ? await getArchiveMutationStatus() : null
  const fresh = await refreshTaskSnapshot()
  const after = startedForReview ? await getArchiveMutationStatus() : null
  return { fresh, version: verifiedReviewVersion(before, after) }
}

function readLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  try {
    return window.localStorage.getItem('codex-triage-language') === 'nl'
      ? 'nl'
      : 'en'
  } catch {
    return 'en'
  }
}
