import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z, ZodError } from 'zod'

import { JEV_MODEL, RUBRIC_VERSION } from './analysis-policy'
import type { Analysis, AnalysisView } from './analysis-types'
import type { Task } from './task-types'

const signal = z.number().min(0).max(1)
const analysisSchema = z.object({
  taskId: z.string(),
  updatedAt: z.number(),
  pinned: z.boolean(),
  analyzedAt: z.number(),
  model: z.string().nullable(),
  rubricVersion: z.string(),
  advice: z.enum(['archive', 'keep', 'review']),
  reason: z.enum([
    'active',
    'completed',
    'insufficientEvidence',
    'outdated',
    'pinned',
    'uncertain',
  ]),
  signals: z
    .object({
      completed: signal,
      openAction: signal,
      stillRelevant: signal,
      outdated: signal,
    })
    .nullable(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative(),
})
const cacheSchema = z.object({
  version: z.literal(1),
  entries: z.array(analysisSchema),
})

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

export function isCurrent(analysis: Analysis, task: Task): boolean {
  return (
    analysis.updatedAt === task.updatedAt &&
    analysis.pinned === task.pinned &&
    analysis.rubricVersion === RUBRIC_VERSION &&
    (analysis.model === JEV_MODEL || analysis.model === null)
  )
}

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
      if (isMissing(error)) return
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
    this.entries.set(analysis.taskId, analysis)
    this.writes = this.writes.catch(() => undefined).then(() => this.write())
    await this.writes
  }

  private async write(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    const path = join(this.directory, 'analysis-v1.json')
    const temporary = `${path}.${String(process.pid)}.tmp`
    await writeFile(
      temporary,
      JSON.stringify({ version: 1, entries: [...this.entries.values()] }),
      { mode: 0o600 },
    )
    await rename(temporary, path)
  }
}

export const analysisCache = new AnalysisCache()
