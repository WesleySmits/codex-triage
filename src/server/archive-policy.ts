import { compareArchiveTasks } from './archive-order'
import type { ExpectedTask, Snapshot, Task } from './task-types'

function expectedMatches(task: Task, expected: ExpectedTask): boolean {
  return (
    task.id === expected.id &&
    task.createdAt === expected.createdAt &&
    task.updatedAt === expected.updatedAt &&
    task.pinned === expected.pinned
  )
}

export function canChangeArchiveState(
  snapshot: Snapshot,
  expected: ExpectedTask,
  archived: boolean,
): boolean {
  if (snapshot.error) return false
  const task = snapshot.tasks.find((item) => item.id === expected.id)
  return archived
    ? task !== undefined && expectedMatches(task, expected)
    : task === undefined
}

export function currentAutomationGroup(
  snapshot: Snapshot,
  automationId: string,
  expected: ExpectedTask[],
): Task[] | null {
  if (
    snapshot.error ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(automationId) ||
    expected.length === 0 ||
    expected.length > 20_000
  )
    return null
  const group = snapshot.tasks.filter(
    (task) => task.automationId === automationId,
  )
  const byId = new Map(expected.map((task) => [task.id, task]))
  if (byId.size !== expected.length || group.length !== expected.length)
    return null
  if (
    !group.every((task) => {
      const match = byId.get(task.id)
      return match !== undefined && expectedMatches(task, match)
    })
  )
    return null
  return [...group].sort(compareArchiveTasks)
}

/** Every selected task must still match the state shown in the review. */
export function currentSelection(
  snapshot: Snapshot,
  expected: ExpectedTask[],
): Task[] | null {
  if (snapshot.error || expected.length === 0 || expected.length > 20_000)
    return null
  const byId = new Map(snapshot.tasks.map((task) => [task.id, task]))
  if (new Set(expected.map((task) => task.id)).size !== expected.length)
    return null
  const tasks: Task[] = []
  for (const item of expected) {
    const task = byId.get(item.id)
    if (!task || !expectedMatches(task, item)) return null
    tasks.push(task)
  }
  return tasks
}
