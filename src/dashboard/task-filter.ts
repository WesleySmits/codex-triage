import type { Snapshot, Task } from '../server/task-types'

export type View = 'all' | 'pinned' | 'unpinned'
export type ProjectFilter =
  { kind: 'all' } | { kind: 'none' } | { kind: 'project'; id: string }

export function tasksInView(tasks: Task[], view: View): Task[] {
  if (view === 'pinned') return tasks.filter((task) => task.pinned)
  if (view === 'unpinned') return tasks.filter((task) => !task.pinned)
  return tasks
}

export function projectCounts(tasks: Task[]): Map<string | null, number> {
  const counts = new Map<string | null, number>()
  for (const task of tasks)
    counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1)
  return counts
}

export function filterTasks(
  tasks: Task[],
  project: ProjectFilter,
  search: string,
  language: string,
): Task[] {
  const needle = search.trim().toLocaleLowerCase(language)
  return tasks.filter(
    (task) =>
      matchesProject(task, project) && matchesSearch(task, needle, language),
  )
}

function matchesProject(task: Task, project: ProjectFilter): boolean {
  if (project.kind === 'all') return true
  if (project.kind === 'none') return task.projectId === null
  return task.projectId === project.id
}

function matchesSearch(task: Task, needle: string, language: string): boolean {
  if (!needle) return true
  const haystack =
    `${task.title ?? ''} ${task.projectName ?? ''} ${task.projectId ?? ''}`.toLocaleLowerCase(
      language,
    )
  return haystack.includes(needle)
}

export function activeProjects(snapshot: Snapshot) {
  const ids = new Set(snapshot.tasks.map((task) => task.projectId))
  return snapshot.projects.filter((project) => ids.has(project.id))
}
