import { useState } from 'react'

import type { Snapshot } from '../server/task-types'
import { DashboardHeader } from './dashboard-header'
import { DashboardMain } from './dashboard-main'
import type { Language } from './i18n'
import {
  activeProjects,
  filterTasks,
  projectCounts,
  type ProjectFilter,
  tasksInView,
  type View,
} from './task-filter'
import { TaskSidebar } from './task-sidebar'

interface Props {
  snapshot: Snapshot
  language: Language
  onLanguageChange: (language: Language) => void
  onRefresh: () => void
  refreshing: boolean
  refreshFailed: boolean
}

export function DashboardView({
  snapshot,
  language,
  onLanguageChange,
  onRefresh,
  refreshing,
  refreshFailed,
}: Props) {
  const {
    view,
    project,
    search,
    viewed,
    filtered,
    pageCount,
    page,
    setPage,
    chooseView,
    chooseProject,
    changeSearch,
  } = useDashboardFilters(snapshot, language)
  const pinnedCount = snapshot.tasks.filter((task) => task.pinned).length

  return (
    <>
      <DashboardHeader
        language={language}
        refreshedAt={snapshot.refreshedAt}
        onLanguageChange={onLanguageChange}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
      <div className="layout">
        <TaskSidebar
          tasks={snapshot.tasks}
          projects={activeProjects(snapshot)}
          view={view}
          project={project}
          counts={projectCounts(viewed)}
          pinnedCount={pinnedCount}
          language={language}
          onView={chooseView}
          onProject={chooseProject}
        />
        <DashboardMain
          snapshot={snapshot}
          language={language}
          view={view}
          pinnedCount={pinnedCount}
          refreshFailed={refreshFailed}
          tasks={filtered}
          search={search}
          onSearch={changeSearch}
          currentPage={Math.min(page, pageCount)}
          pageCount={pageCount}
          onPage={setPage}
        />
      </div>
    </>
  )
}

function useDashboardFilters(snapshot: Snapshot, language: Language) {
  const [view, setView] = useState<View>('all')
  const [project, setProject] = useState<ProjectFilter>({ kind: 'all' })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const viewed = tasksInView(snapshot.tasks, view)
  const filtered = filterTasks(
    viewed,
    project,
    search,
    language === 'nl' ? 'nl-NL' : 'en-US',
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / 25))
  function chooseView(next: View) {
    setView(next)
    setPage(1)
  }
  function chooseProject(next: ProjectFilter) {
    setProject(next)
    setPage(1)
  }
  function changeSearch(next: string) {
    setSearch(next)
    setPage(1)
  }
  return {
    view,
    project,
    search,
    viewed,
    filtered,
    pageCount,
    page,
    setPage,
    chooseView,
    chooseProject,
    changeSearch,
  }
}
