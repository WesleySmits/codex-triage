import type { ArchiveStatus, Snapshot } from '../server/task-types'

export interface Reconciliation {
  required: boolean
  activeReviewed: boolean
  archivedReviewed: boolean
}

export const clearReconciliation: Reconciliation = {
  required: false,
  activeReviewed: false,
  archivedReviewed: false,
}

export function needsReconciliation(status: ArchiveStatus): boolean {
  return ['partial', 'uncertain', 'stale', 'busy'].includes(status)
}

export function canStartWrite(state: Reconciliation, busy: boolean): boolean {
  return !state.required && !busy
}

export function requireReconciliation(): Reconciliation {
  return { required: true, activeReviewed: false, archivedReviewed: false }
}

export function reviewActive(
  state: Reconciliation,
  snapshot: Snapshot,
): Reconciliation {
  if (!state.required || snapshot.error) return state
  return { ...state, activeReviewed: true }
}

export function reviewArchived(state: Reconciliation): Reconciliation {
  if (!state.required) return state
  return { ...state, archivedReviewed: true }
}

export function canAcknowledge(state: Reconciliation): boolean {
  return state.required && state.activeReviewed && state.archivedReviewed
}

export function acknowledge(state: Reconciliation): Reconciliation {
  return canAcknowledge(state) ? clearReconciliation : state
}
