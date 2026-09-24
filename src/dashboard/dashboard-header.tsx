import { type Language, translator } from './i18n'

interface Props {
  language: Language
  refreshedAt: number | null
  onLanguageChange: (language: Language) => void
  onRefresh: () => void
  refreshing: boolean
}

export function DashboardHeader({
  language,
  refreshedAt,
  onLanguageChange,
  onRefresh,
  refreshing,
}: Props) {
  const t = translator(language)
  const time = refreshedAt ? formatTime(refreshedAt, language) : null
  return (
    <>
      <a className="skip-link" href="#task-list">
        {t('skip')}
      </a>
      <header className="app-header">
        <div className="brand">
          Codex <span>/ Triage</span>
        </div>
        <div className="header-actions">
          <label className="language-picker">
            <span className="sr-only">{t('language')}</span>
            <select
              aria-label={t('language')}
              value={language}
              onChange={(event) => {
                onLanguageChange(languageFromValue(event.target.value))
              }}
            >
              <option value="en">English</option>
              <option value="nl">Nederlands</option>
            </select>
          </label>
          <span className="sync-time">
            {time ? t('refreshed', { time }) : t('notRefreshed')}
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={refreshing}
            onClick={onRefresh}
          >
            {refreshing ? t('working') : t('refresh')}
          </button>
        </div>
      </header>
    </>
  )
}

function languageFromValue(value: string): Language {
  return value === 'nl' ? 'nl' : 'en'
}

function formatTime(time: number, language: Language): string {
  return new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(time)
}
