import { describe, expect, it } from 'vitest'

import { signalKey, type SignalType } from './automation-signals'

describe('automation signal labels', () => {
  it.each([
    ['completed', 'signalCompleted'],
    ['openAction', 'signalOpenAction'],
    ['obsolete', 'signalObsolete'],
  ] as const)('maps %s to %s', (signal, key) => {
    expect(signalKey(signal)).toBe(key)
  })

  it('rejects an unknown runtime signal instead of showing Obsolete', () => {
    expect(() => signalKey('unexpected' as SignalType)).toThrow(
      'Unknown automation signal type',
    )
  })
})
