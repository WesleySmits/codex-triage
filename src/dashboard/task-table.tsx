import type { AnalysisView } from '../server/analysis-types'
import type { Task } from '../server/task-types'
import { type Language, translate, translator } from './i18n'
import type { AnalysisControls } from './use-analysis'

interface Props {
  tasks: Task[]
  language: Language
  analysis: AnalysisControls
}

export function TaskTable({ tasks, language, analysis }: Props) {
  const t = translator(language)
  const byId = new Map(analysis.views.map((view) => [view.taskId, view]))
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">{t('taskTable')}</caption>
        <thead>
          <tr>
            <th scope="col" className="selection-column">
              <span className="sr-only">{t('selectTask')}</span>
            </th>
            <th scope="col">{t('task')}</th>
            <th scope="col">{t('project')}</th>
            <th scope="col">{t('updated')}</th>
            <th scope="col">{t('status')}</th>
            <th scope="col">{t('advice')}</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              language={language}
              view={byId.get(task.id)}
              selected={analysis.selected.includes(task.id)}
              onToggle={analysis.toggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface RowProps {
  task: Task
  language: Language
  view: AnalysisView | undefined
  selected: boolean
  onToggle: (id: string) => void
}

function TaskRow({ task, language, view, selected, onToggle }: RowProps) {
  const t = translator(language)
  const date = new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(task.updatedAt * 1000))
  return (
    <tr>
      <td className="selection-column">
        <input
          type="checkbox"
          aria-label={selectionLabel(task, language)}
          checked={selected}
          onChange={() => {
            onToggle(task.id)
          }}
        />
      </td>
      <td>
        <div className="title-line">
          <PinMark
            pinned={task.pinned}
            label={translate(language, 'pinnedTask')}
          />
          <strong>{displayTitle(task, language)}</strong>
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
        {taskStatus(task, language)}
      </td>
      <td className="advice-cell">
        <span className="mobile-label">{t('advice')} · </span>
        <AdviceValue view={view} language={language} />
      </td>
    </tr>
  )
}

function selectionLabel(task: Task, language: Language): string {
  return translate(language, 'selectTaskNamed', {
    title: task.title ?? task.id,
  })
}

function displayTitle(task: Task, language: Language): string {
  return task.title ?? translate(language, 'untitled')
}

function taskStatus(task: Task, language: Language): string {
  return translate(language, task.pinned ? 'pinnedTask' : 'regularTask')
}

function AdviceValue({
  view,
  language,
}: {
  view: AnalysisView | undefined
  language: Language
}) {
  const t = translator(language)
  if (!view) return <span className="muted">{t('notAnalyzed')}</span>
  return (
    <span className={`advice advice-${view.analysis.advice}`}>
      {t(`advice_${view.analysis.advice}`)}
      {view.status === 'stale' && ` · ${t('staleAnalysis')}`}
    </span>
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
