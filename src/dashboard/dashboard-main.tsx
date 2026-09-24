import type { Snapshot, Task } from '../server/task-types'
import { AnalysisPanel } from './analysis-panel'
import { ArchivedList, ArchivePanel } from './archive-panel'
import type { AutomationGroup } from './automation-groups'
import { AutomationList } from './automation-list'
import { type Language, translator } from './i18n'
import type { View } from './task-filter'
import { TaskList } from './task-list'
import type { AnalysisControls } from './use-analysis'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  snapshot: Snapshot
  language: Language
  view: View
  pinnedCount: number
  refreshFailed: boolean
  tasks: Task[]
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

export function DashboardMain({
  snapshot,
  language,
  view,
  pinnedCount,
  refreshFailed,
  tasks,
  search,
  onSearch,
  currentPage,
  pageCount,
  onPage,
  analysis,
  screen,
  groups,
  archive,
  allTasks,
}: Props) {
  return (
    <main id="task-list" className="main-content" tabIndex={-1}>
      <MainHeading
        screen={screen}
        view={view}
        language={language}
        taskCount={snapshot.tasks.length}
        pinnedCount={pinnedCount}
      />
      <MainNotices
        snapshot={snapshot}
        refreshFailed={refreshFailed}
        language={language}
      />
      <ArchivePanel archive={archive} language={language} />
      <MainBody
        {...{
          screen,
          search,
          onSearch,
          groups,
          language,
          analysis,
          tasks,
          currentPage,
          pageCount,
          onPage,
          archive,
          allTasks,
        }}
      />
    </main>
  )
}

function MainBody(props: MainListProps) {
  if (props.screen === 'archived')
    return <ArchivedList archive={props.archive} language={props.language} />
  return (
    <>
      <AnalysisPanel analysis={props.analysis} language={props.language} />
      <MainList {...props} />
    </>
  )
}

function MainNotices({
  snapshot,
  refreshFailed,
  language,
}: Pick<Props, 'snapshot' | 'refreshFailed' | 'language'>) {
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
  | 'currentPage'
  | 'pageCount'
  | 'onPage'
  | 'archive'
  | 'allTasks'
>

function MainList({
  screen,
  search,
  onSearch,
  groups,
  language,
  analysis,
  tasks,
  currentPage,
  pageCount,
  onPage,
  archive,
  allTasks,
}: MainListProps) {
  const t = translator(language)
  return screen === 'automations' ? (
    <>
      <label className="search-field automation-search">
        <span className="sr-only">{t('search')}</span>
        <input
          type="search"
          value={search}
          placeholder={t('search')}
          onChange={(event) => {
            onSearch(event.target.value)
          }}
        />
      </label>
      <AutomationList
        groups={groups}
        language={language}
        analysis={analysis}
        archive={archive}
        allTasks={allTasks}
      />
    </>
  ) : (
    <TaskList
      tasks={tasks}
      language={language}
      search={search}
      onSearch={onSearch}
      currentPage={currentPage}
      pageCount={pageCount}
      onPage={onPage}
      analysis={analysis}
      archive={archive}
    />
  )
}

function headingKey(view: View) {
  if (view === 'pinned') return 'pinnedTasks'
  if (view === 'unpinned') return 'unpinnedTasks'
  return 'allTasks'
}
