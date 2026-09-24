import type { AnalysisProgress } from '../server/analysis-types'
import type { Task } from '../server/task-types'
import type { AutomationGroup } from './automation-groups'

export function filteredSelectionIds(
  tasks: Task[],
  groups: AutomationGroup[],
  automations: boolean,
): string[] {
  return automations
    ? groups.flatMap((group) => group.runs.map((run) => run.id))
    : tasks.map((task) => task.id)
}

export function availableSelection(
  selected: string[],
  tasks: Task[],
): string[] {
  const available = new Set(tasks.map((task) => task.id))
  return selected.filter((id) => available.has(id))
}

export function toggleSelection(selected: string[], id: string): string[] {
  return selected.includes(id)
    ? selected.filter((item) => item !== id)
    : [...selected, id]
}

export function selectFiltered(
  selected: string[],
  filteredIds: string[],
): string[] {
  return [...new Set([...selected, ...filteredIds])]
}

export function deselectFiltered(
  selected: string[],
  filteredIds: string[],
): string[] {
  const filtered = new Set(filteredIds)
  return selected.filter((id) => !filtered.has(id))
}

export function analysisRequestIds(
  selected: string[],
  tasks: Task[],
  status: { configured: boolean; progress: AnalysisProgress } | null,
  busy: boolean,
): string[] {
  if (!status) return []
  if (
    [busy, !status.configured, status.progress.status === 'running'].some(
      Boolean,
    )
  )
    return []
  return availableSelection(selected, tasks)
}
