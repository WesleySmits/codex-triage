import type { ExpectedTask } from './task-types'

function inputRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(message)
  return value as Record<string, unknown>
}

function taskId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(value))
    throw new Error('Invalid task ID')
  return value
}

function timestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Invalid task timestamp')
  return value
}

function pinStatus(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid task pin status')
  return value
}

export function parseExpectedTask(value: unknown): ExpectedTask {
  const task = inputRecord(value, 'Invalid task')
  return {
    id: taskId(task.id),
    createdAt: timestamp(task.createdAt),
    updatedAt: timestamp(task.updatedAt),
    pinned: pinStatus(task.pinned),
  }
}

function automationId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value)
  )
    throw new Error('Invalid automation ID')
  return value
}

function groupTasks(value: unknown): ExpectedTask[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20_000)
    throw new Error('Invalid group size')
  return value.map(parseExpectedTask)
}

export function parseArchiveGroup(value: unknown): {
  automationId: string
  tasks: ExpectedTask[]
} {
  const input = inputRecord(value, 'Invalid group')
  return {
    automationId: automationId(input.automationId),
    tasks: groupTasks(input.tasks),
  }
}
