import { describe, expect, it, vi } from 'vitest'

import { minimize, readEvidence } from './analysis-evidence'
import type { Task } from './task-types'

describe('external text minimization', () => {
  it('removes common contact, link, path, and secret shapes before truncating', () => {
    const text =
      'mail hello@example.com https://example.com/a /Users/person/private sk-exampletoken1234567890'
    expect(minimize(text, 200)).toBe('mail [email] [link] [path] [secret]')
    expect(minimize(text, 10)).toHaveLength(10)
  })

  it('reads opening and latest turns through the supplied connection', async () => {
    const task: Task = {
      id: 'synthetic-task',
      title: 'Synthetic task',
      createdAt: 1,
      updatedAt: 2,
      pinned: false,
      projectId: null,
      projectName: null,
      automationId: null,
    }
    const rpc = {
      request: vi.fn((_: string, params: Record<string, unknown>) =>
        Promise.resolve({
          data: [
            {
              id: params.sortDirection === 'asc' ? 'first' : 'latest',
              items:
                params.sortDirection === 'asc'
                  ? [
                      {
                        type: 'userMessage',
                        content: [{ type: 'text', text: 'Please help' }],
                      },
                    ]
                  : [{ type: 'agentMessage', text: 'Done' }],
            },
          ],
        }),
      ),
    }
    expect(await readEvidence(rpc, task)).toEqual({
      title: 'Synthetic task',
      openingRequest: 'Please help',
      latestUser: '',
      latestAssistant: 'Done',
    })
    expect(rpc.request).toHaveBeenCalledTimes(2)
  })
})
