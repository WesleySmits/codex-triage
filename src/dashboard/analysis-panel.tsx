import type { AnalysisProgress } from '../server/analysis-types'
import type { Task } from '../server/task-types'
import { type Language, translator } from './i18n'
import type { AnalysisControls } from './use-analysis'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  analysis: AnalysisControls
  language: Language
  filteredTaskIds: string[]
  tasks: Task[]
  archive: ArchiveControls
}

export function AnalysisPanel({
  analysis,
  language,
  filteredTaskIds,
  tasks,
  archive,
}: Props) {
  const t = translator(language)
  const progress = analysis.status?.progress

  return (
    <section className="analysis-panel" aria-labelledby="analysis-title">
      <div className="analysis-panel-top">
        <div>
          <p className="eyebrow">Jev</p>
          <h2 id="analysis-title">{t('analysisTitle')}</h2>
          <p>{t('analysisPrivacy')}</p>
        </div>
        <AnalysisButtons
          analysis={analysis}
          language={language}
          filteredTaskIds={filteredTaskIds}
          tasks={tasks}
          archive={archive}
        />
      </div>
      <p className="analysis-note">{t('analysisAdvisory')}</p>
      <AnalysisNotices analysis={analysis} language={language} />
      <ProgressSection progress={progress} language={language} />
    </section>
  )
}

function AnalysisNotices({
  analysis,
  language,
}: Pick<Props, 'analysis' | 'language'>) {
  const t = translator(language)
  return (
    <>
      {analysis.status?.configured === false && (
        <p className="analysis-unavailable">{t('analysisUnconfigured')}</p>
      )}
      {analysis.error !== null && (
        <p className="notice error" role="alert">
          {t('analysisFailed')}: {analysis.error}
        </p>
      )}
    </>
  )
}

function AnalysisButtons({
  analysis,
  language,
  filteredTaskIds,
  tasks,
  archive,
}: Props) {
  const t = translator(language)
  const running = analysis.status?.progress.status === 'running'
  const disabled = [
    !analysis.status?.configured,
    !analysis.selected.length,
    running,
    analysis.busy,
  ].some(Boolean)
  return (
    <div className="analysis-actions">
      <span aria-live="polite">
        {t('analysisSelected', { count: analysis.selected.length })}
      </span>
      <FilteredSelectionButtons
        analysis={analysis}
        language={language}
        filteredTaskIds={filteredTaskIds}
      />
      <button
        className="button secondary"
        type="button"
        disabled={analysis.selected.length === 0 || analysis.busy}
        onClick={analysis.clear}
      >
        {t('clearSelection')}
      </button>
      <button
        className="button primary"
        type="button"
        disabled={disabled}
        onClick={() => void analysis.start()}
      >
        {t('startAnalysis')}
      </button>
      <ArchiveSelectedButton
        analysis={analysis}
        archive={archive}
        tasks={tasks}
        language={language}
      />
      {running && (
        <button
          className="button secondary"
          type="button"
          disabled={analysis.busy}
          onClick={() => void analysis.cancel()}
        >
          {t('cancelAnalysis')}
        </button>
      )}
    </div>
  )
}

function ArchiveSelectedButton({
  analysis,
  archive,
  tasks,
  language,
}: Pick<Props, 'analysis' | 'archive' | 'tasks' | 'language'>) {
  const t = translator(language)
  const disabled =
    analysis.selected.length === 0 ||
    archive.busy ||
    archive.reconciliation.required ||
    !archive.storageChecked
  return (
    <button
      className="button secondary"
      type="button"
      disabled={disabled}
      onClick={() => {
        const selected = new Set(analysis.selected)
        const selectedTasks = tasks.filter((task) => selected.has(task.id))
        if (selectedTasks.length)
          archive.request({ kind: 'selection', tasks: selectedTasks })
      }}
    >
      {t('archiveSelected', { count: analysis.selected.length })}
    </button>
  )
}

function FilteredSelectionButtons({
  analysis,
  language,
  filteredTaskIds,
}: Pick<Props, 'analysis' | 'language' | 'filteredTaskIds'>) {
  const t = translator(language)
  const filtered = new Set(filteredTaskIds)
  const selectedFilteredCount = analysis.selected.filter((id) =>
    filtered.has(id),
  ).length
  return (
    <>
      <button
        className="button secondary"
        type="button"
        disabled={
          filtered.size === 0 || selectedFilteredCount === filtered.size
        }
        onClick={() => {
          analysis.selectFiltered(filteredTaskIds)
        }}
      >
        {t('selectFiltered', { count: filtered.size })}
      </button>
      <button
        className="button secondary"
        type="button"
        disabled={selectedFilteredCount === 0}
        onClick={() => {
          analysis.deselectFiltered(filteredTaskIds)
        }}
      >
        {t('deselectFiltered')}
      </button>
    </>
  )
}

function ProgressSection({
  progress,
  language,
}: {
  progress: AnalysisProgress | undefined
  language: Language
}) {
  if (!progress || progress.status === 'idle') return null
  return <AnalysisProgressView progress={progress} language={language} />
}

function AnalysisProgressView({
  progress,
  language,
}: {
  progress: NonNullable<AnalysisControls['status']>['progress']
  language: Language
}) {
  const t = translator(language)
  return (
    <div className="analysis-progress" role="status" aria-live="polite">
      <strong>{t(`analysisStatus_${progress.status}`)}</strong>
      <progress value={progress.completed} max={progress.total || 1} />
      <span>
        {t('analysisProgress', {
          completed: progress.completed,
          total: progress.total,
          cached: progress.cached,
          analyzed: progress.analyzed,
          failed: progress.failed,
        })}
      </span>
      <span>
        {t('analysisUsage', {
          input: progress.inputTokens,
          output: progress.outputTokens,
          seconds: Math.round(progress.elapsedMs / 1000),
        })}
      </span>
    </div>
  )
}
