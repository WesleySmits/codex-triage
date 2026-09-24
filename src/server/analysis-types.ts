export type Advice = 'archive' | 'keep' | 'review'
export type Reason =
  | 'active'
  | 'completed'
  | 'insufficientEvidence'
  | 'outdated'
  | 'pinned'
  | 'uncertain'

export interface Signals {
  completed: number
  openAction: number
  obsolete: number
}

export interface LegacySignals {
  completed: number
  openAction: number
  stillRelevant: number
  outdated: number
}

export interface Analysis {
  taskId: string
  updatedAt: number
  pinned: boolean
  analyzedAt: number
  model: string | null
  rubricVersion: string
  advice: Advice
  reason: Reason
  signals: LegacySignals | Signals | null
  inputTokens: number
  outputTokens: number
  elapsedMs: number
}

export interface AnalysisView {
  taskId: string
  status: 'current' | 'stale'
  analysis: Analysis
}

export interface AnalysisProgress {
  status: 'idle' | 'running' | 'complete' | 'cancelled'
  total: number
  completed: number
  analyzed: number
  cached: number
  failed: number
  inputTokens: number
  outputTokens: number
  elapsedMs: number
  lastCompletedId: string | null
}
