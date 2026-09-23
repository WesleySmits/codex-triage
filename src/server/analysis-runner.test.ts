import { afterEach, describe, expect, it, vi } from 'vitest'

import { JEV_MODEL, RUBRIC_VERSION } from './analysis-policy'
import { AnalysisRunner } from './analysis-runner'
import type { Analysis } from './analysis-types'
import type { Snapshot, Task } from './task-types'

const tasks: Task[] = Array.from({ length: 6 }, (_, index) => ({
  id: `synthetic-${String(index)}`,
  title: `Task ${String(index)}`,
  createdAt: 1,
  updatedAt: 2,
  pinned: false,
  projectId: null,
  projectName: null,
  automationId: null,
}))
const snapshot: Snapshot = {
  tasks,
  projects: [],
  refreshedAt: 3,
  error: null,
}

function fakeAnalysis(task: Task): Analysis {
  return {
    taskId: task.id,
    updatedAt: task.updatedAt,
    pinned: false,
    analyzedAt: 4,
    model: JEV_MODEL,
    rubricVersion: RUBRIC_VERSION,
    advice: 'review',
    reason: 'uncertain',
    signals: null,
    inputTokens: 10,
    outputTokens: 2,
    elapsedMs: 5,
  }
}

const originalApiKey = process.env.TYPESAFE_API_KEY

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY
  else process.env.TYPESAFE_API_KEY = originalApiKey
})

describe('analysis runner', () => {
  it('requires a local key and explicit selected IDs', async () => {
    delete process.env.TYPESAFE_API_KEY
    const source = { refresh: vi.fn().mockResolvedValue(snapshot) }
    const cache = { get: vi.fn(), save: vi.fn() }
    const runner = new AnalysisRunner(source, cache, vi.fn())
    await expect(runner.start([tasks[0]?.id ?? ''])).rejects.toThrow(
      'not configured',
    )
    expect(source.refresh).not.toHaveBeenCalled()
    expect(runner.status().progress.status).toBe('idle')
  })

  it('reports cache hits, failures, tokens, and completion across batches', async () => {
    process.env.TYPESAFE_API_KEY = 'synthetic-key'
    const source = { refresh: vi.fn().mockResolvedValue(snapshot) }
    const cache = {
      get: vi.fn((task: Task) =>
        Promise.resolve(task.id === tasks[0]?.id ? fakeAnalysis(task) : null),
      ),
      save: vi.fn().mockResolvedValue(undefined),
    }
    const analyze = vi.fn((task: Task) => {
      if (task.id === tasks[2]?.id)
        return Promise.reject(new Error('synthetic failure'))
      return Promise.resolve(fakeAnalysis(task))
    })
    const rpc = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      request: vi.fn().mockResolvedValue({ data: [] }),
    }
    const runner = new AnalysisRunner(source, cache, analyze, () => rpc)
    await runner.start(tasks.map((task) => task.id))
    await vi.waitFor(() => {
      expect(runner.status().progress.status).toBe('complete')
    })
    expect(runner.status().progress).toMatchObject({
      total: 6,
      completed: 6,
      cached: 1,
      failed: 1,
      analyzed: 4,
      inputTokens: 40,
      outputTokens: 8,
    })
    expect(cache.save).toHaveBeenCalledTimes(4)
    expect(rpc.connect).toHaveBeenCalledTimes(1)
    expect(rpc.close).toHaveBeenCalledTimes(1)
  })
})

describe('live batch progress', () => {
  it('reports a settled task while another task in the batch is running', async () => {
    process.env.TYPESAFE_API_KEY = 'synthetic-key'
    const first = tasks[0]
    const second = tasks[1]
    if (!first || !second) throw new Error('Missing synthetic tasks')
    let release: () => void = () => {
      throw new Error('Pending task was not initialized')
    }
    const pending = new Promise<Analysis>((resolve) => {
      release = () => {
        resolve(fakeAnalysis(second))
      }
    })
    const analyze = vi.fn((task: Task) =>
      task.id === second.id ? pending : Promise.resolve(fakeAnalysis(task)),
    )
    const rpc = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      request: vi.fn().mockResolvedValue({ data: [] }),
    }
    const runner = new AnalysisRunner(
      { refresh: vi.fn().mockResolvedValue(snapshot) },
      {
        get: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(undefined),
      },
      analyze,
      () => rpc,
    )
    await runner.start([first.id, second.id])
    await vi.waitFor(() => {
      expect(runner.status().progress).toMatchObject({
        status: 'running',
        completed: 1,
        lastCompletedId: first.id,
      })
    })
    release()
    await vi.waitFor(() => {
      expect(runner.status().progress.status).toBe('complete')
    })
  })
})
