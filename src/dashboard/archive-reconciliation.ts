import type {
  ArchiveMutationStatus,
  ArchiveStatus,
  Snapshot,
} from '../server/task-types'

export interface Reconciliation {
  required: boolean
  activeReviewed: boolean
  archivedReviewed: boolean
  reviewVersion: string | null
}

export const clearReconciliation: Reconciliation = {
  required: false,
  activeReviewed: false,
  archivedReviewed: false,
  reviewVersion: null,
}

export function needsReconciliation(status: ArchiveStatus): boolean {
  return ['partial', 'uncertain', 'stale', 'busy'].includes(status)
}

export function canStartWrite(state: Reconciliation, busy: boolean): boolean {
  return !state.required && !busy
}

export function requireReconciliation(): Reconciliation {
  return {
    required: true,
    activeReviewed: false,
    archivedReviewed: false,
    reviewVersion: null,
  }
}

/** A review is valid only if no mutation spans the list fetch. */
export function verifiedReviewVersion(
  before: ArchiveMutationStatus | null,
  after: ArchiveMutationStatus | null,
): string | null {
  return before &&
    after &&
    !before.busy &&
    !after.busy &&
    before.version === after.version
    ? after.version
    : null
}

export function reviewActive(
  state: Reconciliation,
  snapshot: Snapshot,
  version: string | null,
): Reconciliation {
  if (!state.required || snapshot.error || !version) return state
  return {
    ...state,
    activeReviewed: true,
    archivedReviewed: state.reviewVersion === version && state.archivedReviewed,
    reviewVersion: version,
  }
}

export function reviewArchived(
  state: Reconciliation,
  version: string | null,
): Reconciliation {
  if (!state.required || !version) return state
  return {
    ...state,
    activeReviewed: state.reviewVersion === version && state.activeReviewed,
    archivedReviewed: true,
    reviewVersion: version,
  }
}

export function canAcknowledge(state: Reconciliation): boolean {
  return Boolean(
    state.required &&
    state.reviewVersion &&
    state.activeReviewed &&
    state.archivedReviewed,
  )
}

export function acknowledge(state: Reconciliation): Reconciliation {
  return canAcknowledge(state) ? clearReconciliation : state
}
