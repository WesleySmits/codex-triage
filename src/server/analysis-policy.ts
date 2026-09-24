import type { Advice, Reason, Signals } from './analysis-types'

export const RUBRIC_VERSION = 'codex-triage-v2'
export const JEV_MODEL = 'jev-1.13.0'

/** Advice applies to this task or automation run, never its broader topic. */
export function advise(
  signals: Signals,
  pinned: boolean,
): { advice: Advice; reason: Reason } {
  if (pinned) return { advice: 'review', reason: 'pinned' }
  const closed = signals.completed >= 0.85 || signals.obsolete >= 0.85
  const noOpenAction = signals.openAction <= 0.2
  if (closed && noOpenAction)
    return {
      advice: 'archive',
      reason: signals.completed >= 0.85 ? 'completed' : 'outdated',
    }
  if (
    signals.openAction >= 0.7 &&
    signals.completed < 0.7 &&
    signals.obsolete < 0.7
  )
    return { advice: 'keep', reason: 'active' }
  return { advice: 'review', reason: 'uncertain' }
}
