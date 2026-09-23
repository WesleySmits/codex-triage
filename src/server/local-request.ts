import { getRequest } from '@tanstack/react-start/server'

function isLocalHost(hostname: string, host: string | null): boolean {
  return (
    ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname) &&
    host !== null &&
    /^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)
  )
}

export function isAllowedLocalRequest(request: Request): boolean {
  const url = new URL(request.url)
  const origin = request.headers.get('origin')
  return (
    isLocalHost(url.hostname, request.headers.get('host')) &&
    (origin === null || origin === url.origin) &&
    request.headers.get('sec-fetch-site') !== 'cross-site'
  )
}

/** Reject remote or cross-site requests before reading local task state. */
export function assertLocalRequest(): void {
  if (!isAllowedLocalRequest(getRequest()))
    throw new Error('Codex Triage is available only on loopback')
}
