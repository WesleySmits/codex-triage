import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { taskStore, type ExpectedTask } from './task-store'

function isLocalHost(hostname: string, host: string | null): boolean {
  return (
    ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname) &&
    host !== null &&
    /^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)
  )
}

function isSameOrigin(origin: string | null, url: URL): boolean {
  return origin === null || origin === url.origin
}

function assertLocalRequest(): void {
  const request = getRequest()
  const url = new URL(request.url)
  if (
    !isLocalHost(url.hostname, request.headers.get('host')) ||
    !isSameOrigin(request.headers.get('origin'), url) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  ) {
    throw new Error('Codex Triage is available only on loopback')
  }
}

function inputRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error(message)
  return value as Record<string, unknown>
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function taskId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(value))
    throw new Error('Invalid task ID')
  return value
}

function timestamp(value: unknown): number {
  if (!finiteNumber(value)) throw new Error('Invalid task timestamp')
  return value
}

function pinStatus(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Invalid task pin status')
  return value
}

function parseExpected(value: unknown): ExpectedTask {
  const task = inputRecord(value, 'Invalid task')
  return {
    id: taskId(task.id),
    createdAt: timestamp(task.createdAt),
    updatedAt: timestamp(task.updatedAt),
    pinned: pinStatus(task.pinned),
  }
}

function parseSingle(value: unknown): ExpectedTask {
  return parseExpected(value)
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
  return value.map(parseExpected)
}

function parseGroup(value: unknown): {
  automationId: string
  tasks: ExpectedTask[]
} {
  const input = inputRecord(value, 'Invalid group')
  return {
    automationId: automationId(input.automationId),
    tasks: groupTasks(input.tasks),
  }
}

export const getTaskSnapshot = createServerFn({ method: 'GET' }).handler(
  async () => {
    assertLocalRequest()
    return taskStore.snapshot()
  },
)

export const refreshTaskSnapshot = createServerFn({ method: 'POST' }).handler(
  async () => {
    assertLocalRequest()
    return taskStore.refresh()
  },
)

export const getArchivedTasks = createServerFn({ method: 'GET' }).handler(
  async () => {
    assertLocalRequest()
    return taskStore.archivedTasks()
  },
)

export const archiveTask = createServerFn({ method: 'POST' })
  .inputValidator(parseSingle)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.setArchived(data, true)
  })

export const unarchiveTask = createServerFn({ method: 'POST' })
  .inputValidator(parseSingle)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.setArchived(data, false)
  })

export const archiveAutomationGroup = createServerFn({ method: 'POST' })
  .inputValidator(parseGroup)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.archiveAutomationGroup(data.automationId, data.tasks)
  })
