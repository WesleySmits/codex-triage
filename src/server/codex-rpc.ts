import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { parsePage, parseRpcReply } from './codex-protocol'

type Pending = {
  resolve(value: unknown): void
  reject(reason: Error): void
  timer: NodeJS.Timeout
}

export interface CodexRpcOptions {
  command?: string
  requestTimeoutMs?: number
  maxPages?: number
  maxItems?: number
}

const PAGE_SIZE = 200

/** Owns the spawned app-server session, request lifecycle, and pagination limits. */
export class CodexRpc {
  private child: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<number, Pending>()
  private nextId = 0
  private ready = false
  private readonly options: Required<CodexRpcOptions>

  constructor(options: CodexRpcOptions = {}) {
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

  async pages<T>(
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

  request(method: string, params: Record<string, unknown>): Promise<unknown> {
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

  private handleLine(line: string): void {
    const reply = parseRpcReply(line)
    if (!reply) return
    const pending = this.pending.get(reply.id)
    if (!pending) return
    this.pending.delete(reply.id)
    clearTimeout(pending.timer)
    if ('error' in reply) pending.reject(new Error(reply.error))
    else pending.resolve(reply.result)
  }

  private failAll(reason: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error(reason))
    }
    this.pending.clear()
  }
}
