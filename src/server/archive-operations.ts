import type { CodexClientLike, CodexThread } from './codex-types'
import { type LocalState, pinnedIds } from './local-codex-state'
import type { ArchiveOutcome, ExpectedTask, Task } from './task-types'

function archivedVersionMatches(
  task: CodexThread | undefined,
  expected: ExpectedTask,
  pinned: boolean,
): boolean {
  return Boolean(
    task &&
    (task.createdAt ?? task.updatedAt) === expected.createdAt &&
    task.updatedAt === expected.updatedAt &&
    pinned === expected.pinned,
  )
}

/** Apply one reviewed archive change and report only states observed in readback. */
export async function writeSingle(
  client: CodexClientLike,
  expected: ExpectedTask,
  archived: boolean,
  loadState: () => Promise<LocalState>,
): Promise<ArchiveOutcome> {
  let attempted = false
  try {
    if (!archived) {
      const task = (await client.listArchivedThreads()).find(
        (item) => item.id === expected.id,
      )
      const pinned = pinnedIds(await loadState()).has(expected.id)
      if (!archivedVersionMatches(task, expected, pinned))
        return { status: 'stale', confirmedIds: [] }
    }
    attempted = true
    if (archived) await client.archiveThread(expected.id)
    else await client.unarchiveThread(expected.id)
    const confirmed = archived
      ? (await client.listArchivedIds()).has(expected.id)
      : await restoredVersionMatches(client, expected, loadState)
    return {
      status: confirmed ? 'complete' : 'uncertain',
      confirmedIds: confirmed ? [expected.id] : [],
    }
  } catch {
    return { status: attempted ? 'uncertain' : 'partial', confirmedIds: [] }
  }
}

async function restoredVersionMatches(
  client: CodexClientLike,
  expected: ExpectedTask,
  loadState: () => Promise<LocalState>,
): Promise<boolean> {
  const [threads, state] = await Promise.all([
    client.listActiveThreads(),
    loadState(),
  ])
  return archivedVersionMatches(
    threads.find((item) => item.id === expected.id),
    expected,
    pinnedIds(state).has(expected.id),
  )
}

/** A group call stops after its first write error and always reads back attempts. */
export async function writeBatch(
  client: CodexClientLike,
  batch: Task[],
  groupLength: number,
): Promise<ArchiveOutcome> {
  const attempted: string[] = []
  let writeFailed = false
  try {
    for (const task of batch) {
      attempted.push(task.id)
      try {
        await client.archiveThread(task.id)
      } catch {
        writeFailed = true
        break
      }
    }
    const archived = await client.listArchivedIds()
    const confirmedIds = attempted.filter((id) => archived.has(id))
    const status =
      writeFailed || confirmedIds.length !== attempted.length
        ? 'partial'
        : batch.length === groupLength
          ? 'complete'
          : 'continue'
    return { status, confirmedIds }
  } catch {
    return {
      status: attempted.length ? 'uncertain' : 'partial',
      confirmedIds: [],
    }
  }
}
