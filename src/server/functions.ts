import { createServerFn } from '@tanstack/react-start'
import { parseArchiveGroup, parseExpectedTask } from './archive-input'
import { assertLocalRequest } from './local-request'
import { taskStore } from './task-store'

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
  .inputValidator(parseExpectedTask)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.setArchived(data, true)
  })

export const unarchiveTask = createServerFn({ method: 'POST' })
  .inputValidator(parseExpectedTask)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.setArchived(data, false)
  })

export const archiveAutomationGroup = createServerFn({ method: 'POST' })
  .inputValidator(parseArchiveGroup)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.archiveAutomationGroup(data.automationId, data.tasks)
  })
