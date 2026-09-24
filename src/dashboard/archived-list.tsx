import type { ExpectedTask } from '../server/task-types'
import { type Language, translator } from './i18n'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  archive: ArchiveControls
  language: Language
}

export function ArchivedList({ archive, language }: Props) {
  const t = translator(language)
  return (
    <section className="archived-list" aria-label={t('archivedTasks')}>
      <div className="archived-heading">
        <h2>{t('archivedTasks')}</h2>
        <button
          className="button secondary"
          type="button"
          disabled={archive.busy}
          onClick={() => void archive.loadArchived()}
        >
          {t('refreshArchived')}
        </button>
      </div>
      <p className="muted">{t('archivedListNote')}</p>
      <ArchivedListBody archive={archive} language={language} />
    </section>
  )
}

function ArchivedListBody({ archive, language }: Props) {
  const t = translator(language)
  if (!archive.archivedLoaded) return <p>{t('archivedNotLoaded')}</p>
  if (archive.archived.length === 0) return <p>{t('noArchivedTasks')}</p>
  return (
    <ul>
      {archive.archived.map((task) => (
        <ArchivedRow
          key={task.id}
          task={task}
          archive={archive}
          language={language}
        />
      ))}
    </ul>
  )
}

function ArchivedRow({
  task,
  archive,
  language,
}: Props & { task: ExpectedTask }) {
  const t = translator(language)
  return (
    <li>
      <span>
        <strong>{task.id}</strong>
        {task.pinned && <small>{t('pinnedTask')}</small>}
      </span>
      <button
        className="button secondary"
        type="button"
        disabled={archive.busy || archive.reconciliation.required}
        onClick={() => {
          archive.request({ kind: 'restore', task })
        }}
      >
        {t('restoreTask')}
      </button>
    </li>
  )
}
