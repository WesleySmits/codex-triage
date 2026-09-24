import type { AnalysisView } from '../server/analysis-types'
import type { Task } from '../server/task-types'
import { signalNames, type SignalType } from './automation-signals'

export interface AutomationGroup {
  id: string
  latest: Task
  runs: Task[]
  additionalSignals: SignalType[]
}

const validId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/

/** Group only server-validated automation IDs; absent IDs remain ordinary tasks. */
export function automationGroups(
  allTasks: Task[],
  visibleTasks: Task[],
  analyses: AnalysisView[],
): AutomationGroup[] {
  const allRuns = new Map<string, Task[]>()
  for (const task of allTasks) {
    if (!task.automationId || !validId.test(task.automationId)) continue
    const runs = allRuns.get(task.automationId) ?? []
    runs.push(task)
    allRuns.set(task.automationId, runs)
  }
  const visibleIds = new Set(visibleTasks.map((task) => task.id))
  const current = new Map(
    analyses
      .filter((view) => view.status === 'current')
      .map((view) => [view.taskId, view.analysis]),
  )
  return [...allRuns]
    .flatMap(([id, tasks]) => {
      const sorted = [...tasks].sort(newestFirst)
      const latest = sorted[0]
      if (!latest) return []
      const runs = sorted.filter((task) => visibleIds.has(task.id))
      if (runs.length === 0) return []
      const latestSignals = signalNames(current.get(latest.id)?.signals)
      const additionalSignals = new Set<SignalType>()
      for (const run of runs) {
        if (run.id === latest.id) continue
        for (const signal of signalNames(current.get(run.id)?.signals)) {
          if (!latestSignals.has(signal)) additionalSignals.add(signal)
        }
      }
      return [{ id, latest, runs, additionalSignals: [...additionalSignals] }]
    })
    .sort((a, b) => newestFirst(a.latest, b.latest))
}

function newestFirst(a: Task, b: Task): number {
  return (
    b.createdAt - a.createdAt ||
    b.updatedAt - a.updatedAt ||
    a.id.localeCompare(b.id)
  )
}
