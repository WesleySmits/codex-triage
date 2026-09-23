import { describe, expect, it } from 'vitest'
import { parseArchiveGroup, parseExpectedTask } from './archive-input'

const expected = {
  id: '00000000-0000-4000-8000-000000000001',
  createdAt: 1,
  updatedAt: 2,
  pinned: false,
}

describe('archive inputs', () => {
  it('accepts a complete expected task and a bounded group', () => {
    expect(parseExpectedTask(expected)).toEqual(expected)
    expect(
      parseArchiveGroup({ automationId: 'sample_job', tasks: [expected] }),
    ).toEqual({
      automationId: 'sample_job',
      tasks: [expected],
    })
  })

  it('rejects invalid metadata and group identities', () => {
    expect(() => parseExpectedTask({ ...expected, updatedAt: '2' })).toThrow()
    expect(() => parseExpectedTask({ ...expected, id: 'other' })).toThrow()
    expect(() =>
      parseArchiveGroup({ automationId: 'bad id', tasks: [expected] }),
    ).toThrow()
    expect(() =>
      parseArchiveGroup({ automationId: 'sample_job', tasks: [] }),
    ).toThrow()
  })
})
