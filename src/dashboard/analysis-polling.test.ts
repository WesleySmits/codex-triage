import { describe, expect, it, vi } from 'vitest'

import type { AnalysisReadout } from './analysis-polling'
import { startAnalysisPolling } from './analysis-polling'

const completed: AnalysisReadout = {
  status: {
    configured: true,
    progress: {
      status: 'complete',
      total: 1,
      completed: 1,
      analyzed: 1,
      cached: 0,
      failed: 0,
      inputTokens: 12,
      outputTokens: 4,
      elapsedMs: 1000,
      lastCompletedId: 'task-1',
    },
  },
  views: [],
}

describe('analysis polling', () => {
  it('recovers after a transient read error and stops after completion', async () => {
    vi.useFakeTimers()
    try {
      const read = vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary status failure'))
        .mockResolvedValueOnce(completed)
      const onResult = vi.fn()
      const onError = vi.fn()
      const stop = startAnalysisPolling({ read, onResult, onError })

      await vi.advanceTimersByTimeAsync(1000)
      expect(onError).toHaveBeenCalledOnce()
      expect(read).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1000)
      expect(onResult).toHaveBeenCalledWith(completed)
      expect(read).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(3000)
      expect(read).toHaveBeenCalledTimes(2)
      stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not retry or update after cleanup', async () => {
    vi.useFakeTimers()
    try {
      let resolve: (value: AnalysisReadout) => void = () => {
        throw new Error('Pending read not initialized')
      }
      const read = vi.fn(
        () =>
          new Promise<AnalysisReadout>((done) => {
            resolve = done
          }),
      )
      const onResult = vi.fn()
      const stop = startAnalysisPolling({ read, onResult, onError: vi.fn() })
      await vi.advanceTimersByTimeAsync(1000)
      stop()
      resolve(completed)
      await vi.advanceTimersByTimeAsync(3000)
      expect(read).toHaveBeenCalledOnce()
      expect(onResult).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
