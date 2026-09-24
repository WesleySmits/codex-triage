import { useEffect, useRef } from 'react'

import { type ArchiveTarget, groupCounts, reviewTasks } from './archive-review'
import { type Language, translator } from './i18n'
import type { ArchiveControls } from './use-archive-actions'

interface Props {
  archive: ArchiveControls
  language: Language
}

export function PendingReview({ archive, language }: Props) {
  const pending = archive.pending
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (pending && !dialog.open) {
      triggerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!pending && dialog.open) {
      dialog.close()
    }
  }, [pending])
  return (
    <dialog
      ref={dialogRef}
      className="archive-dialog"
      aria-labelledby="archive-dialog-title"
      aria-describedby="archive-dialog-description archive-dialog-warning"
      onCancel={(event) => {
        if (archive.busy) event.preventDefault()
      }}
      onClose={() => {
        if (!archive.busy) archive.cancel()
        const trigger = triggerRef.current
        if (
          !archive.busy &&
          trigger?.isConnected &&
          !trigger.hasAttribute('disabled')
        )
          trigger.focus()
        else document.getElementById('archive-feedback')?.focus()
      }}
    >
      {pending && (
        <DialogContent
          pending={pending}
          archive={archive}
          language={language}
          cancelRef={cancelRef}
          onCancel={() => dialogRef.current?.close()}
        />
      )}
    </dialog>
  )
}

function DialogContent({
  pending,
  archive,
  language,
  cancelRef,
  onCancel,
}: Props & {
  pending: ArchiveTarget
  cancelRef: React.RefObject<HTMLButtonElement | null>
  onCancel: () => void
}) {
  const t = translator(language)
  const restoring = pending.kind === 'restore'
  const tasks = reviewTasks(pending)
  const pinnedInBatch = tasks.slice(0, 10).filter((task) => task.pinned).length
  return (
    <>
      <p className="archive-dialog-eyebrow">{t('archiveReviewTitle')}</p>
      <h2 id="archive-dialog-title">
        {t(restoring ? 'restoreConfirmTitle' : 'archiveConfirmTitle')}
      </h2>
      <p id="archive-dialog-description">
        {targetDescription(pending, language)}
      </p>
      <DialogTaskSummary tasks={tasks} language={language} />
      <p id="archive-dialog-warning" className="archive-warning">
        {t('archiveConfirmWarning')}
      </p>
      {pinnedInBatch > 0 && (
        <p id="archive-dialog-pinned-warning" className="archive-warning">
          {t('archivePinnedWarning', { count: pinnedInBatch })}
        </p>
      )}
      <div className="archive-buttons">
        <button
          ref={cancelRef}
          className="button secondary"
          type="button"
          disabled={archive.busy}
          onClick={onCancel}
        >
          {t('cancelAction')}
        </button>
        <button
          className="button primary"
          type="button"
          disabled={archive.busy}
          onClick={() => void archive.confirm()}
        >
          {t(restoring ? 'confirmRestore' : 'confirmArchiveCount', {
            count: Math.min(tasks.length || 1, 10),
          })}
        </button>
      </div>
    </>
  )
}

function DialogTaskSummary({
  tasks,
  language,
}: {
  tasks: Extract<ArchiveTarget, { kind: 'selection' }>['tasks']
  language: Language
}) {
  if (tasks.length === 0) return null
  const t = translator(language)
  const counts = groupCounts(tasks)
  const pinnedInBatch = tasks.slice(0, 10).filter((task) => task.pinned).length
  return (
    <>
      <div className="archive-dialog-counts">
        <span>
          <strong>{counts.total}</strong>
          {t('archiveSelectedCount')}
        </span>
        <span>
          <strong>{pinnedInBatch}</strong>
          {t('archivePinnedInBatch')}
        </span>
        <span>
          <strong>{Math.min(counts.total, 10)} / 10</strong>
          {t('archiveBatchCount')}
        </span>
      </div>
      <ul className="archive-dialog-tasks">
        {tasks.slice(0, 10).map((task) => (
          <li key={task.id}>
            {task.title ?? task.id}
            {task.pinned ? ` · ${t('pinnedTask')}` : ''}
          </li>
        ))}
      </ul>
    </>
  )
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
  if (target.kind === 'selection')
    return t(
      target.tasks.length > 10
        ? 'archiveSelectionConfirmLarge'
        : 'archiveSelectionConfirm',
      { count: target.tasks.length },
    )
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
