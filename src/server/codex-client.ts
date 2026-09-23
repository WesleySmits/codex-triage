import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { CodexClientLike, CodexProject, CodexThread } from './codex-types'
export type { CodexClientLike, CodexProject, CodexThread } from './codex-types'

type Pending = {
  resolve(value: unknown): void
  reject(reason: Error): void
  timer: NodeJS.Timeout
}

export interface CodexClientOptions {
  command?: string
  requestTimeoutMs?: number
  maxPages?: number
  maxItems?: number
}

const PAGE_SIZE = 200

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

function parseThread(value: unknown): CodexThread {
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

function parseProject(value: unknown): CodexProject {
  const row = record(value)
  return {
    id: requiredString(row.id, 'project.id'),
    name: requiredString(row.name, 'project.name'),
  }
}

function parsePage<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
): { data: T[]; nextCursor: string | null } {
  const page = record(value)
  if (!Array.isArray(page.data))
    throw new Error('Invalid page data from Codex app-server')
  const nextCursor = optionalString(page.nextCursor, 'nextCursor')
  return { data: page.data.map(parseItem), nextCursor }
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

function parseOpeningText(value: unknown): string | null {
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

/** One local stdio connection. Call connect before operations and close when finished. */
export class CodexClient implements CodexClientLike {
  private child: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<number, Pending>()
  private nextId = 0
  private ready = false
  private readonly options: Required<CodexClientOptions>

  constructor(options: CodexClientOptions = {}) {
    this.options = {
      command: options.command ?? 'codex',
      requestTimeoutMs: options.requestTimeoutMs ?? 15_000,
      maxPages: options.maxPages ?? 100,
      maxItems: options.maxItems ?? 20_000,
    }
    if (
      this.options.requestTimeoutMs < 1 ||
      this.options.maxPages < 1 ||
      this.options.maxItems < 1
    ) {
      throw new Error('Codex client limits must be positive')
    }
  }

  async connect(): Promise<void> {
    if (this.child) throw new Error('Codex client is already connected')
    const child = spawn(this.options.command, ['app-server', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    })
    this.child = child
    child.stderr.resume()
    child.on('error', (error) =>
      this.failAll(`Codex app-server failed to start: ${error.message}`),
    )
    child.on('exit', (code) => {
      this.ready = false
      this.failAll(`Codex app-server exited (${code})`)
    })
    void (async () => {
      try {
        for await (const line of createInterface({ input: child.stdout }))
          this.handleLine(line)
      } catch (error) {
        this.failAll(`Codex app-server output failed: ${String(error)}`)
      }
    })()
    try {
      await this.request('initialize', {
        clientInfo: { name: 'codex-triage', version: '0.1.0' },
        capabilities: { experimentalApi: true },
      })
      child.stdin.write(`${JSON.stringify({ method: 'initialized' })}\n`)
      this.ready = true
    } catch (error) {
      this.close()
      throw error
    }
  }

  close(): void {
    const child = this.child
    if (!child) return
    this.child = null
    this.ready = false
    this.failAll('Codex client closed')
    child.stdin.end()
    child.kill()
  }

  async listActiveThreads(): Promise<CodexThread[]> {
    return this.pages(
      'thread/list',
      { archived: false, useStateDbOnly: true, sortKey: 'recency_at' },
      parseThread,
    )
  }

  async listArchivedIds(): Promise<Set<string>> {
    const threads = await this.listArchivedThreads()
    return new Set(threads.map((thread) => thread.id))
  }

  async listArchivedThreads(): Promise<CodexThread[]> {
    return this.pages(
      'thread/list',
      { archived: true, useStateDbOnly: true },
      parseThread,
    )
  }

  async listProjects(): Promise<CodexProject[]> {
    return this.pages('project/list', {}, parseProject)
  }

  async readOpeningUserText(threadId: string): Promise<string | null> {
    const result = await this.request('thread/turns/list', {
      threadId: requiredString(threadId, 'threadId'),
      sortDirection: 'asc',
      limit: 1,
      itemsView: 'full',
    })
    return parseOpeningText(result)
  }

  async archiveThread(threadId: string): Promise<void> {
    await this.request('thread/archive', {
      threadId: requiredString(threadId, 'threadId'),
    })
  }

  async unarchiveThread(threadId: string): Promise<void> {
    await this.request('thread/unarchive', {
      threadId: requiredString(threadId, 'threadId'),
    })
  }

  private async pages<T>(
    method: string,
    params: Record<string, unknown>,
    parseItem: (item: unknown) => T,
  ): Promise<T[]> {
    const all: T[] = []
    const cursors = new Set<string>()
    let cursor: string | null = null
    for (let pageNumber = 0; pageNumber < this.options.maxPages; pageNumber++) {
      const result = await this.request(method, {
        ...params,
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      })
      const page = parsePage(result, parseItem)
      all.push(...page.data)
      if (all.length > this.options.maxItems)
        throw new Error(`Too many results from ${method}`)
      if (!page.nextCursor) return all
      if (cursors.has(page.nextCursor))
        throw new Error(`Repeated cursor from ${method}`)
      cursors.add(page.nextCursor)
      cursor = page.nextCursor
    }
    throw new Error(`Too many pages from ${method}`)
  }

  private handleLine(line: string): void {
    let value: unknown
    try {
      value = JSON.parse(line) as unknown
    } catch {
      return
    }
    let message: Record<string, unknown>
    try {
      message = record(value)
    } catch {
      return
    }
    if (typeof message.id !== 'number') return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    clearTimeout(pending.timer)
    if (message.error !== undefined) {
      let detail = 'Unknown Codex app-server error'
      try {
        const error = record(message.error)
        if (typeof error.message === 'string') detail = error.message
      } catch {
        /* Keep the bounded generic error. */
      }
      pending.reject(new Error(detail))
    } else if ('result' in message) {
      pending.resolve(message.result)
    } else {
      pending.reject(new Error('Codex app-server reply has no result'))
    }
  }

  private request(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const child = this.child
    if (!child || (method !== 'initialize' && !this.ready)) {
      return Promise.reject(new Error('Codex client is not connected'))
    }
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Codex app-server timed out at ${method}`))
      }, this.options.requestTimeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      child.stdin.write(
        `${JSON.stringify({ id, method, params })}\n`,
        (error) => {
          if (!error) return
          const pending = this.pending.get(id)
          if (!pending) return
          this.pending.delete(id)
          clearTimeout(pending.timer)
          pending.reject(
            new Error(`Codex app-server write failed: ${error.message}`),
          )
        },
      )
    })
  }

  private failAll(reason: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error(reason))
    }
    this.pending.clear()
  }
}
