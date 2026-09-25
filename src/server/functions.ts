import { createServerFn } from '@tanstack/react-start'

import { analysisCache } from './analysis-cache-instance'
import { parseAnalysisIds } from './analysis-input'
import { analysisRunner } from './analysis-runner-instance'
import {
  parseArchiveGroup,
  parseArchiveSelection,
  parseExpectedTask,
} from './archive-input'
import { assertLocalRequest } from './local-request'
import { taskStore } from './task-store-instance'

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

export const getArchiveMutationStatus = createServerFn({
  method: 'POST',
}).handler(() => {
  assertLocalRequest()
  return taskStore.archiveMutationStatus()
})

export const archiveTask = createServerFn({ method: 'POST' })
  .validator(parseExpectedTask)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.setArchived(data, true)
  })

export const unarchiveTask = createServerFn({ method: 'POST' })
  .validator(parseExpectedTask)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.setArchived(data, false)
  })

export const archiveAutomationGroup = createServerFn({ method: 'POST' })
  .validator(parseArchiveGroup)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.archiveAutomationGroup(data.automationId, data.tasks)
  })

export const archiveSelectedTasks = createServerFn({ method: 'POST' })
  .validator(parseArchiveSelection)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return taskStore.archiveSelection(data)
  })

export const getAnalysisStatus = createServerFn({ method: 'GET' }).handler(
  () => {
    assertLocalRequest()
    return analysisRunner.status()
  },
)

export const getAnalyses = createServerFn({ method: 'GET' }).handler(
  async () => {
    assertLocalRequest()
    const snapshot = await taskStore.snapshot()
    return analysisCache.views(snapshot.tasks)
  },
)

export const startAnalysis = createServerFn({ method: 'POST' })
  .validator(parseAnalysisIds)
  .handler(async ({ data }) => {
    assertLocalRequest()
    return analysisRunner.start(data)
  })

export const cancelAnalysis = createServerFn({ method: 'POST' }).handler(() => {
  assertLocalRequest()
  return analysisRunner.cancel()
})
