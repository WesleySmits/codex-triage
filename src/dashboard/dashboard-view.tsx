import { useState } from 'react'

import type { Snapshot } from '../server/task-types'
import { automationGroups } from './automation-groups'
import { DashboardHeader } from './dashboard-header'
import { DashboardMain } from './dashboard-main'
import type { Language } from './i18n'
import {
  activeProjects,
  arrangeTasks,
  filterTasks,
  projectCounts,
  type ProjectFilter,
  type TaskGrouping,
  tasksInView,
  type TaskSort,
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
  const refresh = { active: onRefresh, busy: refreshing, failed: refreshFailed }
  return (
    <>
      <DashboardHeader
        {...{ language, onLanguageChange, onRefresh, refreshing }}
        refreshedAt={snapshot.refreshedAt}
      />
      <div className="layout">
        <TaskSidebar
          tasks={tasks}
          projects={activeProjects(snapshot)}
          view={filters.view}
          project={filters.project}
          counts={projectCounts(filters.viewed)}
          pinnedCount={filters.pinnedCount}
          {...{ language, screen }}
          onView={filters.chooseView}
          onProject={filters.chooseProject}
          onScreen={chooseScreen}
          automationCount={groups.length}
        />
        <DashboardMain
          {...{ snapshot, language, analysis, screen, groups, archive }}
          view={filters.view}
          pinnedCount={filters.pinnedCount}
          refresh={refresh}
          tasks={filters.filtered}
          project={filters.project}
          sort={filters.sort}
          grouping={filters.grouping}
          onSort={filters.changeSort}
          onGrouping={filters.changeGrouping}
          search={filters.search}
          onSearch={filters.changeSearch}
          currentPage={Math.min(filters.page, filters.pageCount)}
          pageCount={filters.pageCount}
          onPage={filters.setPage}
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
  const pinnedCount = snapshot.tasks.filter((task) => task.pinned).length
  const [view, setView] = useState<View>('all')
  const [project, setProject] = useState<ProjectFilter>({ kind: 'all' })
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<TaskSort>('recent')
  const [grouping, setGrouping] = useState<TaskGrouping>('none')
  const [page, setPage] = useState(1)
  const viewed = tasksInView(snapshot.tasks, view)
  const filtered = arrangeTasks(
    filterTasks(viewed, project, search, language === 'nl' ? 'nl-NL' : 'en-US'),
    sort,
    project.kind === 'all' ? grouping : 'none',
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
  function changeSort(next: TaskSort) {
    setSort(next)
    setPage(1)
  }
  function changeGrouping(next: TaskGrouping) {
    setGrouping(next)
    setPage(1)
  }
  return {
    pinnedCount,
    view,
    project,
    search,
    sort,
    grouping,
    viewed,
    filtered,
    pageCount,
    page,
    setPage,
    chooseView,
    chooseProject,
    changeSearch,
    changeSort,
    changeGrouping,
  }
}
