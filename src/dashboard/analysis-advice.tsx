import type { AnalysisView } from '../server/analysis-types'
import { type Language, translator } from './i18n'

export function AdviceValue({
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
