import type { Task } from '../server/task-types'
import { type Language, translate, translator } from './i18n'

interface Props {
  tasks: Task[]
  language: Language
}

export function TaskTable({ tasks, language }: Props) {
  const t = translator(language)
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">{t('taskTable')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('task')}</th>
            <th scope="col">{t('project')}</th>
            <th scope="col">{t('updated')}</th>
            <th scope="col">{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} language={language} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TaskRow({ task, language }: { task: Task; language: Language }) {
  const t = translator(language)
  const date = new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(task.updatedAt * 1000))
  return (
    <tr>
      <td>
        <div className="title-line">
          <PinMark
            pinned={task.pinned}
            label={translate(language, 'pinnedTask')}
          />
          <strong>{task.title ?? translate(language, 'untitled')}</strong>
        </div>
        <span className="thread-id">{task.id}</span>
      </td>
      <td className="project-cell">
        <span className="mobile-label">{t('project')} · </span>
        {projectLabel(task, language)}
      </td>
      <td className="date-cell">
        <span className="mobile-label">{t('updated')} · </span>
        {date}
      </td>
      <td className="status-cell">
        <span className="mobile-label">{t('status')} · </span>
        {translate(language, task.pinned ? 'pinnedTask' : 'regularTask')}
      </td>
    </tr>
  )
}

function PinMark({ pinned, label }: { pinned: boolean; label: string }) {
  return pinned ? (
    <span className="pin" aria-label={label}>
      ◆
    </span>
  ) : null
}

function projectLabel(task: Task, language: Language): string {
  if (!task.projectId) return translate(language, 'noProject')
  return (
    task.projectName ??
    translate(language, 'unknownProject', { id: task.projectId.slice(0, 8) })
  )
}
