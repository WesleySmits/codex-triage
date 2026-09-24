import type { Task } from '../server/task-types'
import { type Language, translator } from './i18n'
import { TaskTable } from './task-table'

interface Props {
  tasks: Task[]
  language: Language
  search: string
  onSearch: (value: string) => void
  currentPage: number
  pageCount: number
  onPage: (page: number) => void
}

export function TaskList({
  tasks,
  language,
  search,
  onSearch,
  currentPage,
  pageCount,
  onPage,
}: Props) {
  const t = translator(language)
  const visible = tasks.slice((currentPage - 1) * 25, currentPage * 25)
  return (
    <>
      <div className="toolbar">
        <label className="search-field">
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
        <span className="result-count" aria-live="polite">
          {t('results', { count: tasks.length })}
        </span>
      </div>
      <TaskTable tasks={visible} language={language} />
      {tasks.length === 0 && (
        <div className="empty-state">
          <h2>{t('noTasks')}</h2>
          <p>{t('adjustFilters')}</p>
        </div>
      )}
      <ListFooter
        count={tasks.length}
        language={language}
        currentPage={currentPage}
        pageCount={pageCount}
        onPage={onPage}
      />
      <p className="source-note">{t('sourceNote')}</p>
    </>
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
