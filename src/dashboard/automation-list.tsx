import type { AnalysisView } from '../server/analysis-types'
import type { Task } from '../server/task-types'
import { AdviceValue } from './analysis-advice'
import type { AutomationGroup } from './automation-groups'
import { signalKey } from './automation-signals'
import { type Language, translator } from './i18n'
import type { AnalysisControls } from './use-analysis'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  groups: AutomationGroup[]
  language: Language
  analysis: AnalysisControls
  archive: ArchiveControls
  allTasks: Task[]
}

export function AutomationList({
  groups,
  language,
  analysis,
  archive,
  allTasks,
}: Props) {
  const t = translator(language)
  const views = new Map(analysis.views.map((view) => [view.taskId, view]))
  return (
    <section className="automation-overview" aria-label={t('automations')}>
      <p className="automation-note">{t('automationGroupingNote')}</p>
      {groups.length === 0 ? (
        <div className="empty-state">
          <h2>{t('noAutomations')}</h2>
          <p>{t('automationDetection')}</p>
        </div>
      ) : (
        <div className="automation-list">
          {groups.map((group) => (
            <AutomationCard
              key={group.id}
              group={group}
              language={language}
              views={views}
              analysis={analysis}
              archive={archive}
              allTasks={allTasks}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function AutomationCard({
  group,
  language,
  views,
  analysis,
  archive,
  allTasks,
}: Pick<Props, 'language' | 'analysis' | 'archive' | 'allTasks'> & {
  group: AutomationGroup
  views: Map<string, AnalysisView>
}) {
  const t = translator(language)
  const completeGroup = allTasks.filter(
    (task) => task.automationId === group.id,
  )
  return (
    <article className="automation-group">
      <div className="automation-card-header">
        <div>
          <h2>{group.latest.title ?? t('untitled')}</h2>
          <span className="automation-id">
            {t('automationId')}: {group.id}
          </span>
        </div>
        <span className="automation-run-count">
          {t('runCount', { count: group.runs.length })}
        </span>
        <GroupArchiveButton
          group={group}
          tasks={completeGroup}
          archive={archive}
          language={language}
        />
      </div>
      <AutomationSummary group={group} views={views} language={language} />
      <details className="automation-runs">
        <summary>{t('showRuns', { count: group.runs.length })}</summary>
        <ol>
          {group.runs.map((run) => (
            <AutomationRun
              key={run.id}
              run={run}
              group={group}
              language={language}
              view={views.get(run.id)}
              analysis={analysis}
              archive={archive}
            />
          ))}
        </ol>
      </details>
    </article>
  )
}

function GroupArchiveButton({
  group,
  tasks,
  archive,
  language,
}: {
  group: AutomationGroup
  tasks: Task[]
  archive: ArchiveControls
  language: Language
}) {
  const t = translator(language)
  return (
    <button
      className="button secondary"
      type="button"
      disabled={archive.busy || archive.reconciliation.required}
      onClick={() => {
        archive.request({ kind: 'group', automationId: group.id, tasks })
      }}
    >
      {t('archiveAllRuns')}
    </button>
  )
}

function AutomationSummary({
  group,
  views,
  language,
}: {
  group: AutomationGroup
  views: Map<string, AnalysisView>
  language: Language
}) {
  const t = translator(language)
  return (
    <div className="automation-card-summary">
      <div>
        <span className="field-label">{t('latestRun')}</span>
        <strong>{formatDate(group.latest, language)}</strong>
        <small>{t('newestRetained')}</small>
      </div>
      <div>
        <span className="field-label">{t('latestAdvice')}</span>
        <AdviceValue view={views.get(group.latest.id)} language={language} />
      </div>
      <div>
        <span className="field-label">{t('additionalSignals')}</span>
        {group.additionalSignals.length ? (
          <strong>
            {group.additionalSignals
              .map((name) => t(signalKey(name)))
              .join(', ')}
          </strong>
        ) : (
          <span className="muted">{t('noAdditionalSignals')}</span>
        )}
      </div>
    </div>
  )
}

function AutomationRun({
  run,
  group,
  language,
  view,
  analysis,
  archive,
}: {
  run: Task
  group: AutomationGroup
  language: Language
  view: AnalysisView | undefined
  analysis: AnalysisControls
  archive: ArchiveControls
}) {
  const t = translator(language)
  return (
    <li>
      <div className="automation-run-select">
        <input
          type="checkbox"
          aria-label={t('selectTaskNamed', { title: run.title ?? run.id })}
          checked={analysis.selected.includes(run.id)}
          onChange={() => {
            analysis.toggle(run.id)
          }}
        />
        <span>
          <strong>{run.title ?? t('untitled')}</strong>
          <small>
            {formatDate(run, language)} · {run.id}
          </small>
        </span>
      </div>
      <div className="automation-run-advice">
        {run.id === group.latest.id && <span>{t('newestRun')}</span>}
        <AdviceValue view={view} language={language} />
        <RunArchiveButton run={run} archive={archive} language={language} />
      </div>
    </li>
  )
}

function RunArchiveButton({
  run,
  archive,
  language,
}: {
  run: Task
  archive: ArchiveControls
  language: Language
}) {
  return (
    <button
      className="button secondary"
      type="button"
      disabled={archive.busy || archive.reconciliation.required}
      onClick={() => {
        archive.request({ kind: 'task', task: run })
      }}
    >
      {translator(language)('archiveAction')}
    </button>
  )
}

function formatDate(task: Task, language: Language): string {
  return new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(task.createdAt * 1000))
}
