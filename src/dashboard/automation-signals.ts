import type { AnalysisView } from '../server/analysis-types'
import type { MessageKey } from './i18n'

export type SignalType = 'completed' | 'openAction' | 'obsolete'

const signalKeys = {
  completed: 'signalCompleted',
  openAction: 'signalOpenAction',
  obsolete: 'signalObsolete',
} as const satisfies Record<SignalType, MessageKey>

export function signalKey(type: SignalType): MessageKey {
  const lookup: Partial<Record<SignalType, MessageKey>> = signalKeys
  const key = lookup[type]
  if (!key) throw new Error('Unknown automation signal type')
  return key
}

export function signalNames(
  signals: AnalysisView['analysis']['signals'] | undefined,
): Set<SignalType> {
  if (!signals) return new Set()
  const names = new Set<SignalType>()
  if (signals.completed >= 0.7) names.add('completed')
  if (signals.openAction >= 0.7) names.add('openAction')
  if ('obsolete' in signals && signals.obsolete >= 0.7) names.add('obsolete')
  return names
}
