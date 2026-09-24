import type { ArchiveResult, ExpectedTask } from '../server/task-types'
import { type ArchiveTarget, expectedTask } from './archive-review'

export interface ArchiveCommands {
  archiveTask: (task: ExpectedTask) => Promise<ArchiveResult>
  restoreTask: (task: ExpectedTask) => Promise<ArchiveResult>
  archiveGroup: (
    automationId: string,
    tasks: ExpectedTask[],
  ) => Promise<ArchiveResult>
  archiveSelection: (tasks: ExpectedTask[]) => Promise<ArchiveResult>
}

/** One reviewed action maps to one server call. The UI never loops over batches. */
export function executeArchive(
  target: ArchiveTarget,
  commands: ArchiveCommands,
) {
  if (target.kind === 'task')
    return commands.archiveTask(expectedTask(target.task))
  if (target.kind === 'restore') return commands.restoreTask(target.task)
  if (target.kind === 'selection')
    return commands.archiveSelection(target.tasks.map(expectedTask))
  return commands.archiveGroup(
    target.automationId,
    target.tasks.map(expectedTask),
  )
}
