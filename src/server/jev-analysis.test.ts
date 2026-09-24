import { describe, expect, it } from 'vitest'

import { analyzeWithJev } from './jev-analysis'
import type { Task } from './task-types'

const task: Task = {
  id: 'task-1',
  title: 'A title alone is not task evidence',
  createdAt: 1,
  updatedAt: 2,
  pinned: false,
  projectId: null,
  projectName: null,
  automationId: null,
}

describe('Jev analysis', () => {
  it('reviews a title-only task without calling Jev', async () => {
    const rpc = { request: () => Promise.resolve({ data: [] }) }
    const analysis = await analyzeWithJev(task, 'unused', rpc)

    expect(analysis).toMatchObject({
      advice: 'review',
      reason: 'insufficientEvidence',
      model: null,
      signals: null,
      inputTokens: 0,
      outputTokens: 0,
    })
  })
})
