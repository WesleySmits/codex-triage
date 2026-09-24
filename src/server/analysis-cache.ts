import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ZodError } from 'zod'

import { cacheSchema, isCurrent } from './analysis-cache-schema'
import type { Analysis, AnalysisView } from './analysis-types'
import type { Task } from './task-types'

/** Stores only judgments and task version metadata in ignored local storage. */
export class AnalysisCache {
  private readonly entries = new Map<string, Analysis>()
  private loaded: Promise<void> | null = null
  private writes = Promise.resolve()

  constructor(private readonly directory = join(process.cwd(), '.data')) {}

  private async load(): Promise<void> {
    const path = join(this.directory, 'analysis-v1.json')
    try {
      const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
      const cache = cacheSchema.parse(parsed)
      for (const entry of cache.entries) this.entries.set(entry.taskId, entry)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return
      if (error instanceof SyntaxError || error instanceof ZodError) {
        await rename(path, `${path}.invalid-${String(Date.now())}`)
        return
      }
      throw error
    }
  }

  private ready(): Promise<void> {
    this.loaded ??= this.load().catch((error: unknown) => {
      this.loaded = null
      throw error
    })
    return this.loaded
  }

  async get(task: Task): Promise<Analysis | null> {
    await this.ready()
    const analysis = this.entries.get(task.id)
    return analysis && isCurrent(analysis, task) ? analysis : null
  }

  async views(tasks: Task[]): Promise<AnalysisView[]> {
    await this.ready()
    return tasks.flatMap((task) => {
      const analysis = this.entries.get(task.id)
      return analysis
        ? [
            {
              taskId: task.id,
              status: isCurrent(analysis, task)
                ? ('current' as const)
                : ('stale' as const),
              analysis,
            },
          ]
        : []
    })
  }

  async save(analysis: Analysis): Promise<void> {
    await this.ready()
    this.writes = this.writes
      .catch(() => undefined)
      .then(async () => {
        const existing = this.entries.get(analysis.taskId)
        if (
          existing &&
          (existing.updatedAt > analysis.updatedAt ||
            (existing.updatedAt === analysis.updatedAt &&
              existing.analyzedAt > analysis.analyzedAt))
        )
          return
        const next = new Map(this.entries)
        next.set(analysis.taskId, analysis)
        await this.write(next)
        this.entries.set(analysis.taskId, analysis)
      })
    await this.writes
  }

  private async write(entries: Map<string, Analysis>): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const path = join(this.directory, 'analysis-v1.json')
    const temporary = `${path}.${String(process.pid)}.tmp`
    await writeFile(
      temporary,
      JSON.stringify({ version: 1, entries: [...entries.values()] }),
      { mode: 0o600 },
    )
    await rename(temporary, path)
  }
}
