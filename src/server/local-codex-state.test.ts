import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { readLocalState } from './local-codex-state'

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
})
