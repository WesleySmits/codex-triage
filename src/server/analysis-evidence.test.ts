import { describe, expect, it } from 'vitest'

import { minimize } from './analysis-evidence'

describe('external text minimization', () => {
  it('removes common contact, link, path, and secret shapes before truncating', () => {
    const text =
      'mail hello@example.com https://example.com/a /Users/person/private sk-exampletoken1234567890'
    expect(minimize(text, 200)).toBe('mail [email] [link] [path] [secret]')
    expect(minimize(text, 10)).toHaveLength(10)
  })
})
