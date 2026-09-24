import type { AnalysisView } from '../server/analysis-types'
import type { Task } from '../server/task-types'
import { AdviceValue } from './analysis-advice'
import type { AutomationGroup } from './automation-groups'
import { signalKey } from './automation-signals'
import { type Language, translator } from './i18n'
import type { AnalysisControls } from './use-analysis'

interface Props {
  groups: AutomationGroup[]
  language: Language
  analysis: AnalysisControls
}

export function AutomationList({ groups, language, analysis }: Props) {
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
}: {
  group: AutomationGroup
  language: Language
  views: Map<string, AnalysisView>
  analysis: AnalysisControls
}) {
  const t = translator(language)
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
            />
          ))}
        </ol>
      </details>
    </article>
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
}: {
  run: Task
  group: AutomationGroup
  language: Language
  view: AnalysisView | undefined
  analysis: AnalysisControls
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
      </div>
    </li>
  )
}

function formatDate(task: Task, language: Language): string {
  return new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(task.createdAt * 1000))
}
