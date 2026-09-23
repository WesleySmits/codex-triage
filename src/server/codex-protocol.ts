import type { CodexProject, CodexThread } from './codex-types'

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Malformed Codex app-server response')
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value)
    throw new Error(`Invalid ${field} from Codex app-server`)
  return value
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  return requiredString(value, field)
}

export function parseThread(value: unknown): CodexThread {
  const row = record(value)
  if (typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt)) {
    throw new Error('Invalid thread.updatedAt from Codex app-server')
  }
  if (
    row.createdAt !== undefined &&
    row.createdAt !== null &&
    (typeof row.createdAt !== 'number' || !Number.isFinite(row.createdAt))
  ) {
    throw new Error('Invalid thread.createdAt from Codex app-server')
  }
  return {
    id: requiredString(row.id, 'thread.id'),
    name: optionalString(row.name, 'thread.name'),
    preview: typeof row.preview === 'string' ? row.preview : '',
    projectId: optionalString(row.projectId, 'thread.projectId'),
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : null,
    updatedAt: row.updatedAt,
  }
}

export function parseProject(value: unknown): CodexProject {
  const row = record(value)
  return {
    id: requiredString(row.id, 'project.id'),
    name: requiredString(row.name, 'project.name'),
  }
}

export function parsePage<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
): { data: T[]; nextCursor: string | null } {
  const page = record(value)
  if (!Array.isArray(page.data))
    throw new Error('Invalid page data from Codex app-server')
  return {
    data: page.data.map(parseItem),
    nextCursor: optionalString(page.nextCursor, 'nextCursor'),
  }
}

function userText(item: unknown): string[] {
  const message = record(item)
  if (message.type !== 'userMessage') return []
  if (!Array.isArray(message.content))
    throw new Error('Invalid user message content from Codex app-server')
  return message.content.flatMap((part: unknown) => {
    const content = record(part)
    return content.type === 'text' && typeof content.text === 'string'
      ? [content.text]
      : []
  })
}

export function parseOpeningText(value: unknown): string | null {
  const page = record(value)
  if (!Array.isArray(page.data))
    throw new Error('Invalid turns page from Codex app-server')
  const turn: unknown = page.data[0]
  if (turn === undefined) return null
  const items = record(turn).items
  if (!Array.isArray(items))
    throw new Error('Invalid turn items from Codex app-server')
  const parts: string[] = items.flatMap(userText)
  return parts.length ? parts.join('\n') : null
}

export type RpcReply =
  { id: number; result: unknown } | { id: number; error: string }

/** Ignore notifications and non-JSON output; identify replies by numeric request ID. */
export function parseRpcReply(line: string): RpcReply | null {
  let value: unknown
  try {
    value = JSON.parse(line) as unknown
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const message = value as Record<string, unknown>
  if (typeof message.id !== 'number') return null
  if (message.error !== undefined) {
    const error = message.error
    const detail =
      typeof error === 'object' && error !== null && !Array.isArray(error)
        ? (error as Record<string, unknown>).message
        : undefined
    return {
      id: message.id,
      error:
        typeof detail === 'string' ? detail : 'Unknown Codex app-server error',
    }
  }
  if ('result' in message) return { id: message.id, result: message.result }
  return { id: message.id, error: 'Codex app-server reply has no result' }
}
