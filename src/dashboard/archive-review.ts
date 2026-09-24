import type { ArchiveResult, ExpectedTask, Task } from '../server/task-types'

export type ArchiveTarget =
  | { kind: 'task'; task: Task }
  | { kind: 'group'; automationId: string; tasks: Task[] }
  | { kind: 'selection'; tasks: Task[] }
  | { kind: 'restore'; task: ExpectedTask }

export interface ArchiveReceipt {
  target: ArchiveTarget
  result: ArchiveResult
}

export function expectedTask(task: Task): ExpectedTask {
  return {
    id: task.id,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    pinned: task.pinned,
  }
}

/** A continuation is a fresh review of the remaining group, never an automatic retry. */
export function remainingGroup(receipt: ArchiveReceipt): ArchiveTarget | null {
  if (
    receipt.target.kind !== 'group' ||
    receipt.result.status !== 'continue' ||
    receipt.result.snapshot.error
  )
    return null
  const { automationId } = receipt.target
  const tasks = receipt.result.snapshot.tasks.filter(
    (task) => task.automationId === automationId,
  )
  return tasks.length ? { kind: 'group', automationId, tasks } : null
}

export function remainingSelection(
  receipt: ArchiveReceipt,
): ArchiveTarget | null {
  if (
    receipt.target.kind !== 'selection' ||
    receipt.result.status !== 'continue' ||
    receipt.result.snapshot.error
  )
    return null
  const confirmed = new Set(receipt.result.confirmedIds)
  const fresh = new Map(
    receipt.result.snapshot.tasks.map((task) => [task.id, task]),
  )
  const remaining = receipt.target.tasks
    .filter((task) => !confirmed.has(task.id))
    .map((task) => fresh.get(task.id))
  if (remaining.some((task) => !task)) return null
  return remaining.length
    ? { kind: 'selection', tasks: remaining as Task[] }
    : null
}

export function groupCounts(tasks: Task[]) {
  return {
    total: tasks.length,
    pinned: tasks.filter((task) => task.pinned).length,
  }
}
