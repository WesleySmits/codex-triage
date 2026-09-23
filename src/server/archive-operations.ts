import type { CodexClientLike, CodexThread } from './codex-types'
import type { ArchiveOutcome, ExpectedTask, Task } from './task-types'

function archivedVersionMatches(
  task: CodexThread | undefined,
  expected: ExpectedTask,
): boolean {
  return Boolean(
    task &&
    (task.createdAt ?? task.updatedAt) === expected.createdAt &&
    task.updatedAt === expected.updatedAt,
  )
}

/** Apply one reviewed archive change and report only states observed in readback. */
export async function writeSingle(
  client: CodexClientLike,
  expected: ExpectedTask,
  archived: boolean,
): Promise<ArchiveOutcome> {
  let attempted = false
  try {
    if (!archived) {
      const task = (await client.listArchivedThreads()).find(
        (item) => item.id === expected.id,
      )
      if (!archivedVersionMatches(task, expected))
        return { status: 'stale', confirmedIds: [] }
    }
    attempted = true
    if (archived) await client.archiveThread(expected.id)
    else await client.unarchiveThread(expected.id)
    const confirmed = archived
      ? (await client.listArchivedIds()).has(expected.id)
      : (await client.listActiveThreads()).some(
          (item) => item.id === expected.id,
        )
    return {
      status: confirmed ? 'complete' : 'uncertain',
      confirmedIds: confirmed ? [expected.id] : [],
    }
  } catch {
    return { status: attempted ? 'uncertain' : 'partial', confirmedIds: [] }
  }
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
