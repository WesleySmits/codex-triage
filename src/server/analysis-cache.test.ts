import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { AnalysisCache, isCurrent } from './analysis-cache'
import { JEV_MODEL, RUBRIC_VERSION } from './analysis-policy'
import type { Analysis } from './analysis-types'
import type { Task } from './task-types'

const task: Task = {
  id: 'synthetic-1',
  title: 'Synthetic task',
  createdAt: 1,
  updatedAt: 2,
  pinned: false,
  projectId: null,
  projectName: null,
  automationId: null,
}
const analysis: Analysis = {
  taskId: task.id,
  updatedAt: task.updatedAt,
  pinned: false,
  analyzedAt: 3,
  model: JEV_MODEL,
  rubricVersion: RUBRIC_VERSION,
  advice: 'review',
  reason: 'uncertain',
  signals: {
    completed: 0.4,
    openAction: 0.5,
    stillRelevant: 0.5,
    outdated: 0.1,
  },
  inputTokens: 10,
  outputTokens: 2,
  elapsedMs: 5,
}

describe('analysis cache', () => {
  const directories: string[] = []
  afterEach(async () => {
    await Promise.all(
      directories
        .splice(0)
        .map((path) => rm(path, { recursive: true, force: true })),
    )
  })

  it('persists judgments without task text and identifies changed tasks', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'triage-analysis-'))
    directories.push(directory)
    const cache = new AnalysisCache(directory)
    await cache.save(analysis)
    const text = await readFile(join(directory, 'analysis-v1.json'), 'utf8')
    expect(text).not.toContain(task.title)
    expect(await new AnalysisCache(directory).get(task)).toEqual(analysis)
    expect(await cache.get({ ...task, updatedAt: 4 })).toBeNull()
    expect(await cache.views([{ ...task, pinned: true }])).toMatchObject([
      { status: 'stale' },
    ])
  })

  it('invalidates an old rubric or model', () => {
    expect(isCurrent({ ...analysis, rubricVersion: 'old' }, task)).toBe(false)
    expect(isCurrent({ ...analysis, model: 'old-model' }, task)).toBe(false)
  })

  it('sets aside a malformed derived cache and continues empty', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'triage-analysis-'))
    directories.push(directory)
    await writeFile(join(directory, 'analysis-v1.json'), '{broken', 'utf8')
    const cache = new AnalysisCache(directory)
    expect(await cache.get(task)).toBeNull()
    const files = await readdir(directory)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^analysis-v1\.json\.invalid-/)
  })
})
