import type { CodexRpc } from './codex-rpc'
import type { Task } from './task-types'

interface Turn {
  id: string
  items: unknown[]
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function turns(value: unknown): Turn[] {
  const data = record(value).data
  if (!Array.isArray(data)) throw new Error('Invalid Codex turns response')
  return data.flatMap((entry: unknown) => {
    const row = record(entry)
    return typeof row.id === 'string' && Array.isArray(row.items)
      ? [{ id: row.id, items: row.items as unknown[] }]
      : []
  })
}

function itemText(item: unknown) {
  const row = record(item)
  if (row.type !== 'userMessage') return ''
  if (!Array.isArray(row.content)) return ''
  return row.content
    .flatMap((part: unknown) => {
      const content = record(part)
      return content.type === 'text' && typeof content.text === 'string'
        ? [content.text]
        : []
    })
    .join(' ')
}

function userText(turn: Turn | undefined) {
  return (turn?.items ?? []).map(itemText).join(' ')
}

function finalAssistantText(turn: Turn | undefined): string {
  for (const item of [...(turn?.items ?? [])].reverse()) {
    const row = record(item)
    if (
      row.type === 'agentMessage' &&
      row.phase === 'final' &&
      typeof row.text === 'string'
    )
      return row.text
  }
  return ''
}

/** Remove common identifiers and bound each field before external transfer. */
export function minimize(text: string, limit: number): string {
  return text
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(
      /\b(?:sk|ghp|gho|github_pat|xoxb|xoxp|Bearer)[-_ ]?[A-Za-z0-9_=-]{12,}\b/gi,
      '[secret]',
    )
    .replace(/(?:\/Users\/|\/home\/|[A-Z]:\\)[^\s]+/gi, '[path]')
    .replace(/\b[A-Za-z0-9+/_=-]{32,}\b/g, '[code]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit)
}

export interface Evidence {
  title: string
  openingRequest: string
  latestUser: string
  latestAssistant: string
}

export async function readEvidence(
  rpc: Pick<CodexRpc, 'request'>,
  task: Task,
): Promise<Evidence> {
  const [first, latest] = await Promise.all([
    rpc.request('thread/turns/list', {
      threadId: task.id,
      sortDirection: 'asc',
      limit: 1,
      itemsView: 'full',
    }),
    rpc.request('thread/turns/list', {
      threadId: task.id,
      sortDirection: 'desc',
      limit: 1,
      itemsView: 'full',
    }),
  ])
  const opening = turns(first)[0]
  const recent = turns(latest)[0]
  return {
    title: minimize(task.title ?? '', 180),
    openingRequest: minimize(userText(opening), 600),
    latestUser:
      recent?.id === opening?.id ? '' : minimize(userText(recent), 350),
    latestAssistant: minimize(finalAssistantText(recent), 700),
  }
}
