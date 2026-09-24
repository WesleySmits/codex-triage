import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { FakeClient } from './fake-client.test-helper'
import { readLocalState } from './local-codex-state'
import { TaskStore } from './task-store'

describe('local Codex state file', () => {
  it('uses empty state when the file is absent and still rejects invalid JSON', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'codex-triage-state-'))
    try {
      expect(await readLocalState(directory)).toEqual({})
      await writeFile(join(directory, '.codex-global-state.json'), '{invalid')
      await expect(readLocalState(directory)).rejects.toThrow()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('loads a large valid state for a task snapshot while retaining a size bound', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'codex-triage-state-'))
    const path = join(directory, '.codex-global-state.json')
    try {
      await writeFile(path, JSON.stringify({ padding: 'x'.repeat(9_000_000) }))
      const client = new FakeClient()
      const store = new TaskStore(
        () => client,
        () => readLocalState(directory),
      )
      const snapshot = await store.snapshot()
      expect(snapshot.error).toBeNull()
      expect(snapshot.refreshedAt).not.toBeNull()

      await truncate(path, 32 * 1024 * 1024 + 1)
      await expect(readLocalState(directory)).rejects.toThrow(
        'Codex state file exceeds the local size limit',
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
