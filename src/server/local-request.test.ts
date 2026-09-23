import { describe, expect, it } from 'vitest'
import { isAllowedLocalRequest } from './local-request'

function request(url: string, headers: Record<string, string>): Request {
  return new Request(url, { headers })
}

describe('local request policy', () => {
  it('accepts same-origin loopback requests', () => {
    expect(
      isAllowedLocalRequest(
        request('http://127.0.0.1:3000/api', {
          host: '127.0.0.1:3000',
          origin: 'http://127.0.0.1:3000',
        }),
      ),
    ).toBe(true)
  })

  it('rejects remote hosts, cross-origin writes, and cross-site browser requests', () => {
    expect(
      isAllowedLocalRequest(
        request('http://example.com/api', { host: 'example.com' }),
      ),
    ).toBe(false)
    expect(
      isAllowedLocalRequest(
        request('http://127.0.0.1:3000/api', {
          host: '127.0.0.1:3000',
          origin: 'https://example.com',
        }),
      ),
    ).toBe(false)
    expect(
      isAllowedLocalRequest(
        request('http://127.0.0.1:3000/api', {
          host: '127.0.0.1:3000',
          'sec-fetch-site': 'cross-site',
        }),
      ),
    ).toBe(false)
  })
})
