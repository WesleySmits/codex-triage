import { needsReconciliation } from './archive-reconciliation'
import { groupCounts, remainingGroup } from './archive-review'
import { type Language, translator } from './i18n'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  archive: ArchiveControls
  language: Language
}

export function ArchivePanel({ archive, language }: Props) {
  const t = translator(language)
  return (
    <section className="archive-panel" aria-label={t('archiveReviewTitle')}>
      <PendingReview archive={archive} language={language} />
      {archive.busy && <p role="status">{t('archiveWorking')}</p>}
      <ArchiveError archive={archive} language={language} />
      <ArchiveReceiptView archive={archive} language={language} />
      <ReconciliationReview archive={archive} language={language} />
    </section>
  )
}

function PendingReview({ archive, language }: Props) {
  const pending = archive.pending
  if (!pending) return null
  const t = translator(language)
  const restoring = pending.kind === 'restore'
  return (
    <div
      className="archive-confirm"
      role="group"
      aria-label={t('archiveReviewTitle')}
    >
      <h2>{t(restoring ? 'restoreConfirmTitle' : 'archiveConfirmTitle')}</h2>
      <p>{targetDescription(pending, language)}</p>
      <p className="archive-warning">{t('archiveConfirmWarning')}</p>
      <div className="archive-buttons">
        <button
          className="button secondary"
          type="button"
          disabled={archive.busy}
          onClick={archive.cancel}
        >
          {t('cancelAction')}
        </button>
        <button
          className="button primary"
          type="button"
          disabled={archive.busy}
          onClick={() => void archive.confirm()}
        >
          {t(restoring ? 'confirmRestore' : 'confirmArchive')}
        </button>
      </div>
    </div>
  )
}

function ArchiveError({ archive, language }: Props) {
  if (!archive.error) return null
  const t = translator(language)
  return (
    <p className="notice error" role="alert">
      {t('archiveUnknownError')} {archive.error} {t('archiveReconcile')}
    </p>
  )
}

function ArchiveReceiptView({ archive, language }: Props) {
  const t = translator(language)
  const receipt = archive.receipt
  if (!receipt) return null
  const { result } = receipt
  const blocked = needsReconciliation(result.status)
  const next = remainingGroup(receipt)
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
  if (next?.kind !== 'group') return null
  const t = translator(language)
  return (
    <>
      <p>{t('archiveRemaining', { count: next.tasks.length })}</p>
      <button
        className="button secondary"
        type="button"
        disabled={archive.busy}
        onClick={archive.reviewRemaining}
      >
        {t('reviewNextBatch')}
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

function ReconciliationReview({ archive, language }: Props) {
  if (!archive.reconciliation.required) return null
  const t = translator(language)
  return (
    <div
      className="notice error"
      role="group"
      aria-label={t('archiveReviewTitle')}
    >
      <p>{t('archiveReconcile')}</p>
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

function targetDescription(
  target: NonNullable<ArchiveControls['pending']>,
  language: Language,
): string {
  const t = translator(language)
  if (target.kind === 'group') {
    const counts = groupCounts(target.tasks)
    return t('archiveGroupConfirm', {
      count: counts.total,
      pinned: counts.pinned,
      id: target.automationId,
    })
  }
  if (target.kind === 'restore')
    return t('restoreTaskConfirm', { id: target.task.id })
  return taskArchiveDescription(target.task, language)
}

function taskArchiveDescription(
  task: Extract<
    NonNullable<ArchiveControls['pending']>,
    { kind: 'task' }
  >['task'],
  language: Language,
) {
  const t = translator(language)
  return t('archiveTaskConfirm', {
    title: task.title ?? task.id,
    id: task.id,
    pinned: t(task.pinned ? 'pinnedTask' : 'regularTask'),
  })
}
