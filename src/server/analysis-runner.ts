import { analysisCache } from './analysis-cache'
import type { Analysis, AnalysisProgress } from './analysis-types'
import { analyzeWithJev } from './jev-analysis'
import { taskStore } from './task-store'
import type { Task } from './task-types'

const BATCH_SIZE = 5

function emptyProgress(): AnalysisProgress {
  return {
    status: 'idle',
    total: 0,
    completed: 0,
    analyzed: 0,
    cached: 0,
    failed: 0,
    inputTokens: 0,
    outputTokens: 0,
    elapsedMs: 0,
    lastCompletedId: null,
  }
}

/** A single local run, started only by a POST server function. */
export class AnalysisRunner {
  private progress = emptyProgress()
  private startedAt = 0
  private cancelRequested = false

  constructor(
    private readonly source: Pick<typeof taskStore, 'refresh'> = taskStore,
    private readonly cache: Pick<
      typeof analysisCache,
      'get' | 'save'
    > = analysisCache,
    private readonly analyze: (
      task: Task,
      apiKey: string,
    ) => Promise<Analysis> = analyzeWithJev,
  ) {}

  status(): { configured: boolean; progress: AnalysisProgress } {
    const elapsedMs =
      this.progress.status === 'running'
        ? Math.round(performance.now() - this.startedAt)
        : this.progress.elapsedMs
    return {
      configured: Boolean(process.env.TYPESAFE_API_KEY?.trim()),
      progress: { ...this.progress, elapsedMs },
    }
  }

  async start(ids: string[]): Promise<AnalysisProgress> {
    if (this.progress.status === 'running')
      throw new Error('Analysis already running')
    const apiKey = process.env.TYPESAFE_API_KEY?.trim()
    if (!apiKey) throw new Error('TypeSafe API key is not configured')
    this.progress = { ...emptyProgress(), status: 'running', total: ids.length }
    this.startedAt = performance.now()
    this.cancelRequested = false
    try {
      const snapshot = await this.source.refresh()
      if (snapshot.error) throw new Error('Could not refresh Codex tasks')
      const byId = new Map(snapshot.tasks.map((task) => [task.id, task]))
      const tasks = ids.map((id) => byId.get(id))
      if (tasks.some((task) => !task)) throw new Error('Selected task is stale')
      void this.run(
        tasks.filter((task): task is Task => Boolean(task)),
        apiKey,
      )
      return this.status().progress
    } catch (error) {
      this.progress = emptyProgress()
      throw error
    }
  }

  cancel(): AnalysisProgress {
    if (this.progress.status === 'running') this.cancelRequested = true
    return this.status().progress
  }

  private async run(tasks: Task[], apiKey: string): Promise<void> {
    for (let index = 0; index < tasks.length; index += BATCH_SIZE) {
      if (this.cancelRequested) break
      const batch = tasks.slice(index, index + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map((task) => this.analyzeOne(task, apiKey)),
      )
      for (const [offset, result] of results.entries()) {
        this.progress.completed++
        this.progress.lastCompletedId = batch[offset]?.id ?? null
        if (result.status === 'rejected') this.progress.failed++
      }
    }
    this.progress.status = this.cancelRequested ? 'cancelled' : 'complete'
    this.progress.elapsedMs = Math.round(performance.now() - this.startedAt)
  }

  private async analyzeOne(task: Task, apiKey: string): Promise<void> {
    const cached = await this.cache.get(task)
    if (cached) {
      this.progress.cached++
      return
    }
    const analysis = await this.analyze(task, apiKey)
    await this.cache.save(analysis)
    this.progress.analyzed++
    this.progress.inputTokens += analysis.inputTokens
    this.progress.outputTokens += analysis.outputTokens
  }
}

export const analysisRunner = new AnalysisRunner()
