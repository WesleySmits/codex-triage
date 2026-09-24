import type { Task } from './task-types'

/** Stable across fresh snapshots even when multiple runs share a timestamp. */
export function compareArchiveTasks(a: Task, b: Task): number {
  return a.createdAt - b.createdAt || a.id.localeCompare(b.id)
}
