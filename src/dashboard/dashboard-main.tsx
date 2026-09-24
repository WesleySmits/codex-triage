import type { Snapshot, Task } from '../server/task-types'
import { AnalysisPanel } from './analysis-panel'
import type { AutomationGroup } from './automation-groups'
import { AutomationList } from './automation-list'
import { type Language, translator } from './i18n'
import type { View } from './task-filter'
import { TaskList } from './task-list'
import type { AnalysisControls } from './use-analysis'

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
  screen: 'tasks' | 'automations'
  groups: AutomationGroup[]
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
}: Props) {
  const t = translator(language)
  return (
    <main id="task-list" className="main-content" tabIndex={-1}>
      <MainHeading
        screen={screen}
        view={view}
        language={language}
        taskCount={snapshot.tasks.length}
        pinnedCount={pinnedCount}
      />
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
      <AnalysisPanel analysis={analysis} language={language} />
      <MainList
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
        }}
      />
    </main>
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
        <h1>
          {t(screen === 'automations' ? 'automations' : headingKey(view))}
        </h1>
        <p>{t(screen === 'automations' ? 'automationIntro' : 'intro')}</p>
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
}: Pick<
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
>) {
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
      <AutomationList groups={groups} language={language} analysis={analysis} />
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
    />
  )
}

function headingKey(view: View) {
  if (view === 'pinned') return 'pinnedTasks'
  if (view === 'unpinned') return 'unpinnedTasks'
  return 'allTasks'
}
