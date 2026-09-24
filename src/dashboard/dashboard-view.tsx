import { useState } from 'react'

import type { Snapshot } from '../server/task-types'
import { automationGroups } from './automation-groups'
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
import type { AnalysisControls } from './use-analysis'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  snapshot: Snapshot
  language: Language
  onLanguageChange: (language: Language) => void
  onRefresh: () => void
  refreshing: boolean
  refreshFailed: boolean
  analysis: AnalysisControls
  archive: ArchiveControls
}

export function DashboardView({
  snapshot,
  language,
  onLanguageChange,
  onRefresh,
  refreshing,
  refreshFailed,
  analysis,
  archive,
}: Props) {
  const [screen, chooseScreen] = useDashboardScreen(archive)
  const { tasks } = snapshot
  const filters = useDashboardFilters(snapshot, language)
  const groups = automationGroups(tasks, filters.filtered, analysis.views)
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
          tasks={tasks}
          projects={activeProjects(snapshot)}
          view={filters.view}
          project={filters.project}
          counts={projectCounts(filters.viewed)}
          pinnedCount={tasks.filter((task) => task.pinned).length}
          language={language}
          onView={filters.chooseView}
          onProject={filters.chooseProject}
          screen={screen}
          onScreen={chooseScreen}
          automationCount={groups.length}
        />
        <DashboardMain
          snapshot={snapshot}
          language={language}
          view={filters.view}
          pinnedCount={tasks.filter((task) => task.pinned).length}
          refreshFailed={refreshFailed}
          tasks={filters.filtered}
          search={filters.search}
          onSearch={filters.changeSearch}
          currentPage={Math.min(filters.page, filters.pageCount)}
          pageCount={filters.pageCount}
          onPage={filters.setPage}
          analysis={analysis}
          screen={screen}
          groups={groups}
          archive={archive}
          allTasks={tasks}
        />
      </div>
    </>
  )
}

function useDashboardScreen(archive: ArchiveControls) {
  const [screen, setScreen] = useState<'tasks' | 'automations' | 'archived'>(
    'tasks',
  )
  function chooseScreen(next: typeof screen) {
    setScreen(next)
    if (next === 'archived' && !archive.archivedLoaded)
      void archive.loadArchived()
  }
  return [screen, chooseScreen] as const
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
