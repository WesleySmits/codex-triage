import type { Snapshot, Task } from '../server/task-types'
import { AnalysisPanel } from './analysis-panel'
import { filteredSelectionIds } from './analysis-selection'
import { ArchivePanel } from './archive-panel'
import { ArchivedList } from './archived-list'
import type { AutomationGroup } from './automation-groups'
import { AutomationList } from './automation-list'
import { type Language, translator } from './i18n'
import type { ProjectFilter, TaskGrouping, TaskSort, View } from './task-filter'
import { TaskList } from './task-list'
import type { AnalysisControls } from './use-analysis'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  snapshot: Snapshot
  language: Language
  view: View
  pinnedCount: number
  refresh: { active: () => void; busy: boolean; failed: boolean }
  tasks: Task[]
  pages: Task[][]
  project: ProjectFilter
  sort: TaskSort
  grouping: TaskGrouping
  onSort: (sort: TaskSort) => void
  onGrouping: (grouping: TaskGrouping) => void
  search: string
  onSearch: (value: string) => void
  currentPage: number
  pageCount: number
  onPage: (page: number) => void
  analysis: AnalysisControls
  screen: 'tasks' | 'automations' | 'archived'
  groups: AutomationGroup[]
  archive: ArchiveControls
  allTasks: Task[]
}

export function DashboardMain(props: Props) {
  return (
    <main id="task-list" className="main-content" tabIndex={-1}>
      <MainHeading
        screen={props.screen}
        view={props.view}
        language={props.language}
        taskCount={props.snapshot.tasks.length}
        pinnedCount={props.pinnedCount}
      />
      <MainNotices
        snapshot={props.snapshot}
        refreshFailed={props.refresh.failed}
        language={props.language}
      />
      <ArchivePanel
        archive={props.archive}
        language={props.language}
        onRefreshActive={props.refresh.active}
        refreshing={props.refresh.busy}
      />
      <MainBody {...props} />
    </main>
  )
}

function MainBody(props: MainListProps) {
  if (props.screen === 'archived')
    return <ArchivedList archive={props.archive} language={props.language} />
  return (
    <>
      <AnalysisPanel
        analysis={props.analysis}
        language={props.language}
        tasks={props.allTasks}
        archive={props.archive}
        filteredTaskIds={filteredSelectionIds(
          props.tasks,
          props.groups,
          props.screen === 'automations',
        )}
      />
      <MainList {...props} />
    </>
  )
}

function MainNotices({
  snapshot,
  refreshFailed,
  language,
}: Pick<Props, 'snapshot' | 'language'> & { refreshFailed: boolean }) {
  const t = translator(language)
  return (
    <>
      {snapshot.error && (
        <div className="notice error" role="alert">
          <strong>{t('syncFailed')}</strong> {t('syncRetry')}
        </div>
      )}
      {refreshFailed && (
        <div className="notice error" role="alert">
          {t('refreshFailed')}
        </div>
      )}
    </>
  )
}

function MainHeading({
  screen,
  view,
  language,
  taskCount,
  pinnedCount,
}: Pick<Props, 'screen' | 'view' | 'language' | 'pinnedCount'> & {
  taskCount: number
}) {
  const t = translator(language)
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{t('localTasks')}</p>
        <h1>{t(screenHeading(screen, view))}</h1>
        <p>{t(screenIntro(screen))}</p>
      </div>
      <div className="summary">
        <strong>{taskCount}</strong>
        <span>{t('tasks')}</span>
        <strong>{pinnedCount}</strong>
        <span>{t('pinned')}</span>
      </div>
    </div>
  )
}

function screenHeading(screen: Props['screen'], view: View) {
  if (screen === 'archived') return 'archivedTasks'
  if (screen === 'automations') return 'automations'
  return headingKey(view)
}

function screenIntro(screen: Props['screen']) {
  if (screen === 'archived') return 'archivedListNote'
  if (screen === 'automations') return 'automationIntro'
  return 'intro'
}

type MainListProps = Pick<
  Props,
  | 'screen'
  | 'search'
  | 'onSearch'
  | 'groups'
  | 'language'
  | 'analysis'
  | 'tasks'
  | 'pages'
  | 'project'
  | 'sort'
  | 'grouping'
  | 'onSort'
  | 'onGrouping'
  | 'currentPage'
  | 'pageCount'
  | 'onPage'
  | 'archive'
  | 'allTasks'
>

function MainList(props: MainListProps) {
  const t = translator(props.language)
  return props.screen === 'automations' ? (
    <>
      <label className="search-field automation-search">
        <span className="sr-only">{t('search')}</span>
        <input
          type="search"
          value={props.search}
          placeholder={t('search')}
          onChange={(event) => {
            props.onSearch(event.target.value)
          }}
        />
      </label>
      <AutomationList
        groups={props.groups}
        language={props.language}
        analysis={props.analysis}
        archive={props.archive}
        allTasks={props.allTasks}
      />
    </>
  ) : (
    <TaskList {...props} />
  )
}

function headingKey(view: View) {
  if (view === 'pinned') return 'pinnedTasks'
  if (view === 'unpinned') return 'unpinnedTasks'
  return 'allTasks'
}
