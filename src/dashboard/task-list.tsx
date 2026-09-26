import type { Task } from '../server/task-types'
import { type Language, translator } from './i18n'
import {
  type ProjectFilter,
  projectGroups,
  type TaskGrouping,
  type TaskSort,
} from './task-filter'
import { TaskTable } from './task-table'
import type { AnalysisControls } from './use-analysis'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  tasks: Task[]
  project: ProjectFilter
  sort: TaskSort
  grouping: TaskGrouping
  onSort: (sort: TaskSort) => void
  onGrouping: (grouping: TaskGrouping) => void
  language: Language
  search: string
  onSearch: (value: string) => void
  currentPage: number
  pageCount: number
  onPage: (page: number) => void
  analysis: AnalysisControls
  archive: ArchiveControls
}

export function TaskList(props: Props) {
  const t = translator(props.language)
  const visible = props.tasks.slice(
    (props.currentPage - 1) * 25,
    props.currentPage * 25,
  )
  const grouped = props.project.kind === 'all' && props.grouping === 'project'
  return (
    <>
      <TaskListControls {...props} count={props.tasks.length} />
      {props.sort !== 'recent' && (
        <p className="sort-note">{t('createdFallback')}</p>
      )}
      <TaskRows {...props} grouped={grouped} tasks={visible} />
      {props.tasks.length === 0 && (
        <div className="empty-state">
          <h2>{t('noTasks')}</h2>
          <p>{t('adjustFilters')}</p>
        </div>
      )}
      <ListFooter
        count={props.tasks.length}
        language={props.language}
        currentPage={props.currentPage}
        pageCount={props.pageCount}
        onPage={props.onPage}
      />
      <p className="source-note">{t('sourceNote')}</p>
    </>
  )
}

function TaskListControls(
  props: Pick<
    Props,
    | 'language'
    | 'search'
    | 'onSearch'
    | 'project'
    | 'sort'
    | 'grouping'
    | 'onSort'
    | 'onGrouping'
  > & { count: number },
) {
  const t = translator(props.language)
  return (
    <div className="toolbar">
      <label className="search-field">
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
      <label className="list-control">
        <span>{t('sortBy')}</span>
        <select
          value={props.sort}
          onChange={(event) => {
            props.onSort(event.target.value as TaskSort)
          }}
        >
          <option value="recent">{t('recentlyActive')}</option>
          <option value="created-newest">{t('createdNewest')}</option>
          <option value="created-oldest">{t('createdOldest')}</option>
        </select>
      </label>
      <label className="list-control">
        <span>{t('groupBy')}</span>
        <select
          value={props.project.kind === 'all' ? props.grouping : 'none'}
          disabled={props.project.kind !== 'all'}
          onChange={(event) => {
            props.onGrouping(event.target.value as TaskGrouping)
          }}
        >
          <option value="none">{t('noGrouping')}</option>
          <option value="project">{t('groupByProject')}</option>
        </select>
      </label>
      <span className="result-count" aria-live="polite">
        {t('results', { count: props.count })}
      </span>
    </div>
  )
}

function TaskRows({
  tasks,
  language,
  analysis,
  archive,
  grouped,
}: Pick<Props, 'tasks' | 'language' | 'analysis' | 'archive'> & {
  grouped: boolean
}) {
  return grouped ? (
    <div className="project-groups">
      {projectGroups(tasks).map(({ id, tasks: groupTasks }) => (
        <ProjectGroup
          key={id ?? 'no-project'}
          {...{ id, language, analysis, archive }}
          tasks={groupTasks}
        />
      ))}
    </div>
  ) : (
    <TaskTable
      tasks={tasks}
      language={language}
      analysis={analysis}
      archive={archive}
    />
  )
}

function ProjectGroup({
  id,
  tasks,
  language,
  analysis,
  archive,
}: Pick<Props, 'tasks' | 'language' | 'analysis' | 'archive'> & {
  id: string | null
}) {
  const t = translator(language)
  const name = id
    ? (tasks[0]?.projectName ?? t('unknownProject', { id: id.slice(0, 8) }))
    : t('noProject')
  return (
    <section className="project-group">
      <div className="project-group-heading">
        <h2>{name}</h2>
        <span>{t('groupCount', { count: tasks.length })}</span>
      </div>
      <TaskTable {...{ tasks, language, analysis, archive }} />
    </section>
  )
}

type FooterProps = Pick<
  Props,
  'language' | 'currentPage' | 'pageCount' | 'onPage'
> & { count: number }

function ListFooter({
  count,
  language,
  currentPage,
  pageCount,
  onPage,
}: FooterProps) {
  const t = translator(language)
  const range = count
    ? `${String((currentPage - 1) * 25 + 1)}–${String(Math.min(currentPage * 25, count))}`
    : '0'
  return (
    <footer className="list-footer">
      <span>
        {range} {t('of')} {count}
      </span>
      <div className="pagination">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => {
            onPage(currentPage - 1)
          }}
        >
          {t('previous')}
        </button>
        <span>{t('pageOf', { page: currentPage, total: pageCount })}</span>
        <button
          type="button"
          disabled={currentPage >= pageCount}
          onClick={() => {
            onPage(currentPage + 1)
          }}
        >
          {t('next')}
        </button>
      </div>
    </footer>
  )
}
