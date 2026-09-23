import { z } from 'zod'

import { JEV_MODEL, RUBRIC_VERSION } from './analysis-policy'
import type { Analysis } from './analysis-types'
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

export const cacheSchema = z.object({
  version: z.literal(1),
  entries: z.array(analysisSchema),
})

export function isCurrent(analysis: Analysis, task: Task): boolean {
  return (
    analysis.updatedAt === task.updatedAt &&
    analysis.pinned === task.pinned &&
    analysis.rubricVersion === RUBRIC_VERSION &&
    (analysis.model === JEV_MODEL || analysis.model === null)
  )
}
