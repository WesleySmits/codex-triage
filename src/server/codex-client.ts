import { parseOpeningText, parseProject, parseThread } from './codex-protocol'
import { CodexRpc, type CodexRpcOptions } from './codex-rpc'
import type { CodexClientLike } from './codex-types'

export type CodexClientOptions = CodexRpcOptions

function threadId(value: string): string {
  if (typeof value !== 'string' || !value)
    throw new Error('Invalid threadId from Codex app-server')
  return value
}

/** Codex task operations over one stateful local RPC session. */
export function createCodexClient(
  options: CodexClientOptions = {},
): CodexClientLike {
  const rpc = new CodexRpc(options)
  const listArchivedThreads = () =>
    rpc.pages(
      'thread/list',
      {
        archived: true,
        useStateDbOnly: true,
      },
      parseThread,
    )
  return {
    connect: () => rpc.connect(),
    close: () => {
      rpc.close()
    },
    listActiveThreads: () =>
      rpc.pages(
        'thread/list',
        {
          archived: false,
          useStateDbOnly: true,
          sortKey: 'recency_at',
        },
        parseThread,
      ),
    listArchivedThreads,
    async listArchivedIds() {
      const threads = await listArchivedThreads()
      return new Set(threads.map((thread) => thread.id))
    },
    listProjects: () => rpc.pages('project/list', {}, parseProject),
    async readOpeningUserText(id) {
      const result = await rpc.request('thread/turns/list', {
        threadId: threadId(id),
        sortDirection: 'asc',
        limit: 1,
        itemsView: 'full',
      })
      return parseOpeningText(result)
    },
    async archiveThread(id) {
      await rpc.request('thread/archive', { threadId: threadId(id) })
    },
    async unarchiveThread(id) {
      await rpc.request('thread/unarchive', { threadId: threadId(id) })
    },
  }
}
