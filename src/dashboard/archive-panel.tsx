import { PendingReview } from './archive-dialog'
import {
  ARCHIVE_EXTERNAL_PENDING,
  ARCHIVE_STORAGE_LOCKED,
} from './archive-persistence'
import { needsReconciliation } from './archive-reconciliation'
import { remainingGroup, remainingSelection } from './archive-review'
import { type Language, translator } from './i18n'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  archive: ArchiveControls
  language: Language
}

interface PanelProps extends Props {
  onRefreshActive: () => void
  refreshing: boolean
}

export function ArchivePanel({
  archive,
  language,
  onRefreshActive,
  refreshing,
}: PanelProps) {
  const t = translator(language)
  return (
    <>
      <PendingReview archive={archive} language={language} />
      <section
        id="archive-feedback"
        className="archive-panel"
        aria-label={t('archiveReviewTitle')}
        tabIndex={-1}
      >
        {archive.busy && <p role="status">{t('archiveWorking')}</p>}
        <ArchiveError archive={archive} language={language} />
        <ArchiveReceiptView archive={archive} language={language} />
        <ReconciliationReview
          archive={archive}
          language={language}
          onRefreshActive={onRefreshActive}
          refreshing={refreshing}
        />
      </section>
    </>
  )
}

function ArchiveError({ archive, language }: Props) {
  if (!archive.error) return null
  const t = translator(language)
  return (
    <p className="notice error" role="alert">
      {t('archiveUnknownError')}{' '}
      {archive.error === ARCHIVE_STORAGE_LOCKED ||
      archive.error === ARCHIVE_EXTERNAL_PENDING
        ? t('archiveStorageLocked')
        : archive.error}{' '}
      {t('archiveReconcile')}
    </p>
  )
}

function ArchiveReceiptView({ archive, language }: Props) {
  const t = translator(language)
  const receipt = archive.receipt
  if (!receipt) return null
  const { result } = receipt
  const blocked = needsReconciliation(result.status)
  const next = remainingGroup(receipt) ?? remainingSelection(receipt)
  return (
    <div
      className={blocked ? 'notice error archive-receipt' : 'archive-receipt'}
      role="status"
      aria-live="polite"
    >
      <strong>{t(`archiveStatus_${result.status}`)}</strong>
      <p>{t('archiveConfirmed', { count: result.confirmedIds.length })}</p>
      <ConfirmedIds ids={result.confirmedIds} />
      <ReceiptContinuation next={next} archive={archive} language={language} />
      <ReceiptReconciliation blocked={blocked} language={language} />
    </div>
  )
}

function ConfirmedIds({ ids }: { ids: string[] }) {
  return ids.length ? <small>{ids.join(', ')}</small> : null
}

function ReceiptContinuation({
  next,
  archive,
  language,
}: Props & { next: ReturnType<typeof remainingGroup> }) {
  if (next?.kind !== 'group' && next?.kind !== 'selection') return null
  const t = translator(language)
  return (
    <>
      <p>
        {t(
          next.kind === 'group'
            ? 'archiveRemaining'
            : 'archiveSelectionRemaining',
          { count: next.tasks.length },
        )}
      </p>
      <button
        className="button secondary"
        type="button"
        disabled={archive.busy}
        onClick={archive.reviewRemaining}
      >
        {t(
          next.kind === 'group'
            ? 'reviewNextBatch'
            : 'reviewNextSelectionBatch',
        )}
      </button>
    </>
  )
}

function ReceiptReconciliation({
  blocked,
  language,
}: {
  blocked: boolean
  language: Language
}) {
  return blocked ? <p>{translator(language)('archiveReconcile')}</p> : null
}

function ReconciliationReview({
  archive,
  language,
  onRefreshActive,
  refreshing,
}: PanelProps) {
  if (!archive.storageChecked || !archive.reconciliation.required) return null
  const t = translator(language)
  return (
    <div
      className="notice error"
      role="group"
      aria-label={t('archiveReviewTitle')}
    >
      <p>{t('archiveReconcile')}</p>
      <button
        className="button secondary"
        type="button"
        disabled={refreshing || archive.busy}
        onClick={onRefreshActive}
      >
        {refreshing ? t('working') : t('refreshActive')}
      </button>
      <button
        className="button secondary"
        type="button"
        disabled={archive.busy}
        onClick={() => void archive.loadArchived()}
      >
        {t('refreshArchived')}
      </button>
      <p>
        {t('archiveReconcileActive', {
          done: reviewMarker(archive.reconciliation.activeReviewed),
        })}
      </p>
      <p>
        {t('archiveReconcileArchived', {
          done: reviewMarker(archive.reconciliation.archivedReviewed),
        })}
      </p>
      <button
        className="button secondary"
        type="button"
        disabled={!archive.canAcknowledge || archive.busy}
        onClick={archive.acknowledgeReconciliation}
      >
        {t('archiveAcknowledge')}
      </button>
    </div>
  )
}

function reviewMarker(reviewed: boolean): string {
  return reviewed ? '✓' : '—'
}
