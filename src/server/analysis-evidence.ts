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

function itemText(item: unknown, type: 'agentMessage' | 'userMessage') {
  const row = record(item)
  if (row.type !== type) return ''
  if (type === 'agentMessage')
    return row.phase !== 'commentary' && typeof row.text === 'string'
      ? row.text
      : ''
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

function textOf(turn: Turn | undefined, type: 'agentMessage' | 'userMessage') {
  return (turn?.items ?? []).map((item) => itemText(item, type)).join(' ')
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
    openingRequest: minimize(textOf(opening, 'userMessage'), 600),
    latestUser:
      recent?.id === opening?.id
        ? ''
        : minimize(textOf(recent, 'userMessage'), 350),
    latestAssistant: minimize(textOf(recent, 'agentMessage'), 700),
  }
}
