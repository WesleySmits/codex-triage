import { analysisCache } from './analysis-cache-instance'
import type { Analysis, AnalysisProgress } from './analysis-types'
import { CodexRpc } from './codex-rpc'
import { analyzeWithJev } from './jev-analysis'
import { taskStore } from './task-store-instance'
import type { Task } from './task-types'

/** A single local run, started only by a POST server function. */
export class AnalysisRunner {
  private static readonly batchSize = 5
  private progress = AnalysisRunner.emptyProgress()
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
      rpc: Pick<CodexRpc, 'request'>,
    ) => Promise<Analysis> = analyzeWithJev,
    private readonly makeRpc: () => Pick<
      CodexRpc,
      'close' | 'connect' | 'request'
    > = () => new CodexRpc(),
  ) {}

  private static emptyProgress(): AnalysisProgress {
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
    this.progress = {
      ...AnalysisRunner.emptyProgress(),
      status: 'running',
      total: ids.length,
    }
    this.startedAt = performance.now()
    this.cancelRequested = false
    try {
      const snapshot = await this.source.refresh()
      if (snapshot.error) throw new Error('Could not refresh Codex tasks')
      const byId = new Map(snapshot.tasks.map((task) => [task.id, task]))
      const tasks = ids.map((id) => byId.get(id))
      if (tasks.some((task) => !task)) throw new Error('Selected task is stale')
      const rpc = this.makeRpc()
      try {
        await rpc.connect()
      } catch (error) {
        rpc.close()
        throw error
      }
      void this.run(
        tasks.filter((task): task is Task => Boolean(task)),
        apiKey,
        rpc,
      )
      return this.status().progress
    } catch (error) {
      this.progress = AnalysisRunner.emptyProgress()
      throw error
    }
  }

  cancel(): AnalysisProgress {
    if (this.progress.status === 'running') this.cancelRequested = true
    return this.status().progress
  }

  private async run(
    tasks: Task[],
    apiKey: string,
    rpc: Pick<CodexRpc, 'close' | 'request'>,
  ): Promise<void> {
    try {
      for (
        let index = 0;
        index < tasks.length;
        index += AnalysisRunner.batchSize
      ) {
        if (this.cancelRequested) break
        const batch = tasks.slice(index, index + AnalysisRunner.batchSize)
        await this.runBatch(batch, apiKey, rpc)
      }
    } finally {
      rpc.close()
      this.progress.status = this.cancelRequested ? 'cancelled' : 'complete'
      this.progress.elapsedMs = Math.round(performance.now() - this.startedAt)
    }
  }

  private async runBatch(
    batch: Task[],
    apiKey: string,
    rpc: Pick<CodexRpc, 'request'>,
  ): Promise<void> {
    await Promise.allSettled(
      batch.map(async (task) => {
        try {
          await this.analyzeOne(task, apiKey, rpc)
        } catch (error) {
          this.progress.failed++
          throw error
        } finally {
          this.progress.completed++
          this.progress.lastCompletedId = task.id
        }
      }),
    )
  }

  private async analyzeOne(
    task: Task,
    apiKey: string,
    rpc: Pick<CodexRpc, 'request'>,
  ): Promise<void> {
    const cached = await this.cache.get(task)
    if (cached) {
      this.progress.cached++
      return
    }
    const analysis = await this.analyze(task, apiKey, rpc)
    await this.cache.save(analysis)
    this.progress.analyzed++
    this.progress.inputTokens += analysis.inputTokens
    this.progress.outputTokens += analysis.outputTokens
  }
}
