import { z } from 'zod'

const idsSchema = z.array(z.string().min(1).max(128)).min(1).max(20_000)

export function parseAnalysisIds(value: unknown): string[] {
  const ids = idsSchema.parse(value)
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate task ID')
  return ids
}
