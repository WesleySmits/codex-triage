import type { AnalysisProgress, AnalysisView } from '../server/analysis-types'

export interface AnalysisReadout {
  status: { configured: boolean; progress: AnalysisProgress }
  views: AnalysisView[]
}

interface PollingOptions {
  read: () => Promise<AnalysisReadout>
  onResult: (readout: AnalysisReadout) => void
  onError: (cause: unknown) => void
}

/** Retry transient read failures while the run is active; stop after completion or cleanup. */
export function startAnalysisPolling(options: PollingOptions): () => void {
  let active = true
  let running = true
  let timer = setTimeout(() => {
    void poll()
  }, 1000)

  async function poll() {
    try {
      const readout = await options.read()
      if (!active) return
      options.onResult(readout)
      running = readout.status.progress.status === 'running'
    } catch (cause) {
      if (active) options.onError(cause)
    } finally {
      if (active && running)
        timer = setTimeout(() => {
          void poll()
        }, 1000)
    }
  }

  return () => {
    active = false
    clearTimeout(timer)
  }
}
