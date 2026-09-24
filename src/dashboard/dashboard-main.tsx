import type { Snapshot, Task } from '../server/task-types'
import { type Language, translator } from './i18n'
import type { View } from './task-filter'
import { TaskList } from './task-list'

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
}: Props) {
  const t = translator(language)
  const heading = headingKey(view)
  return (
    <main id="task-list" className="main-content" tabIndex={-1}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('localTasks')}</p>
          <h1>{t(heading)}</h1>
          <p>{t('intro')}</p>
        </div>
        <div className="summary">
          <strong>{snapshot.tasks.length}</strong>
          <span>{t('tasks')}</span>
          <strong>{pinnedCount}</strong>
          <span>{t('pinned')}</span>
        </div>
      </div>
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
      <TaskList
        tasks={tasks}
        language={language}
        search={search}
        onSearch={onSearch}
        currentPage={currentPage}
        pageCount={pageCount}
        onPage={onPage}
      />
    </main>
  )
}

function headingKey(view: View) {
  if (view === 'pinned') return 'pinnedTasks'
  if (view === 'unpinned') return 'unpinnedTasks'
  return 'allTasks'
}
