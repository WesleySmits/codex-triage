import type { CodexClientLike, CodexProject, CodexThread } from './codex-types'
import {
  type LocalState,
  pinnedIds,
  projectAssignment,
  projectNames,
} from './local-codex-state'
import type { ExpectedTask, Project, Task } from './task-types'

export function detectAutomationId(text: string): string | null {
  const lines = text.trimStart().split(/\r?\n/, 12)
  if (!/^Automation:\s*\S/.test(lines[0] ?? '')) return null
  const line = lines
    .slice(1)
    .find((entry) => entry.startsWith('Automation ID:'))
  return (
    /^Automation ID:\s*([A-Za-z0-9][A-Za-z0-9_-]{0,127})\s*$/.exec(
      line ?? '',
    )?.[1] ?? null
  )
}

function taskTitle(raw: CodexThread): string | null {
  const name = raw.name?.trim()
  if (name) return name
  const preview = raw.preview.split(/\r?\n/, 1)[0]?.slice(0, 100)
  return preview?.length ? preview : null
}

async function automationIds(
  client: CodexClientLike,
  rawTasks: CodexThread[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>()
  for (const task of rawTasks) {
    const id = detectAutomationId(task.preview)
    if (id) ids.set(task.id, id)
  }
  const fallback = rawTasks.filter(
    (task) =>
      /^Automation:\s*\S/.test(
        task.preview.trimStart().split(/\r?\n/, 1)[0] ?? '',
      ) && !ids.has(task.id),
  )
  for (let offset = 0; offset < fallback.length; offset += 8) {
    await Promise.all(
      fallback.slice(offset, offset + 8).map(async (task) => {
        try {
          const text = await client.readOpeningUserText(task.id)
          const id = text ? detectAutomationId(text) : null
          if (id) ids.set(task.id, id)
        } catch {
          /* A missing opening turn leaves the automation ID unknown. */
        }
      }),
    )
  }
  return ids
}

interface TaskContext {
  state: LocalState
  pins: Set<string>
  names: Map<string, string | null>
  ids: Map<string, string>
}

function toTask(raw: CodexThread, context: TaskContext): Task {
  const { state, pins, names, ids } = context
  const projectId = raw.projectId ?? projectAssignment(state, raw.id)
  if (projectId && !names.has(projectId)) names.set(projectId, null)
  return {
    id: raw.id,
    title: taskTitle(raw),
    createdAt: raw.createdAt ?? raw.updatedAt,
    updatedAt: raw.updatedAt,
    pinned: pins.has(raw.id),
    projectId,
    projectName: projectId ? (names.get(projectId) ?? null) : null,
    automationId: ids.get(raw.id) ?? null,
  }
}

/** Normalize one active app-server listing with the local pin and project state. */
export async function normalizeActiveTasks(
  client: CodexClientLike,
  rawTasks: CodexThread[],
  rawProjects: CodexProject[],
  state: LocalState,
): Promise<{ tasks: Task[]; projects: Project[] }> {
  const pins = pinnedIds(state)
  const names = projectNames(rawProjects, state)
  const ids = await automationIds(client, rawTasks)
  const context = { state, pins, names, ids }
  const tasks = rawTasks.map((raw) => toTask(raw, context))
  const projects = [...names]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))
  return { tasks, projects }
}

export function normalizeArchivedTasks(
  rawTasks: CodexThread[],
  state: LocalState,
): ExpectedTask[] {
  const pins = pinnedIds(state)
  return rawTasks.map((task) => ({
    id: task.id,
    createdAt: task.createdAt ?? task.updatedAt,
    updatedAt: task.updatedAt,
    pinned: pins.has(task.id),
  }))
}
