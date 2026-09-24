import type { Advice, Reason, Signals } from './analysis-types'

export const RUBRIC_VERSION = 'codex-triage-v1'
export const JEV_MODEL = 'jev-1.13.0'

/** Pilot thresholds are conservative advice rules, not calibrated accuracy. */
export function advise(
  signals: Signals,
  pinned: boolean,
): { advice: Advice; reason: Reason } {
  const completed = signals.completed >= 0.85 && signals.openAction <= 0.2
  const outdated =
    signals.outdated >= 0.85 &&
    signals.stillRelevant <= 0.2 &&
    signals.openAction <= 0.2
  if (completed || outdated) {
    if (pinned) return { advice: 'review', reason: 'pinned' }
    return {
      advice: 'archive',
      reason: completed ? 'completed' : 'outdated',
    }
  }
  if (signals.openAction >= 0.7 || signals.stillRelevant >= 0.7)
    return { advice: 'keep', reason: 'active' }
  return { advice: 'review', reason: 'uncertain' }
}
