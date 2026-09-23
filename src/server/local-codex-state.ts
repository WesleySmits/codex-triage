import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CodexProject } from './codex-types'

export interface LocalState {
  'pinned-thread-ids'?: unknown
  'thread-project-assignments'?: unknown
  'local-projects'?: unknown
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringField(value: unknown, key: string): string | null {
  const field = record(value)[key]
  return typeof field === 'string' ? field : null
}

export async function readLocalState(
  codexHome = process.env.CODEX_HOME ?? join(homedir(), '.codex'),
): Promise<LocalState> {
  const path = join(codexHome, '.codex-global-state.json')
  let file
  try {
    file = await stat(path)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return {}
    throw error
  }
  if (file.size > 4_000_000)
    throw new Error('Codex state file exceeds the local size limit')
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Codex state file has an invalid shape')
  }
  return parsed
}

export function pinnedIds(state: LocalState): Set<string> {
  const value = state['pinned-thread-ids']
  return new Set(
    Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : [],
  )
}

export function projectNames(
  rawProjects: CodexProject[],
  state: LocalState,
): Map<string, string | null> {
  const names = new Map<string, string | null>(
    rawProjects.map((project) => [project.id, project.name]),
  )
  for (const [id, project] of Object.entries(record(state['local-projects']))) {
    names.set(id, stringField(project, 'name'))
  }
  return names
}

export function projectAssignment(
  state: LocalState,
  threadId: string,
): string | null {
  return stringField(
    record(state['thread-project-assignments'])[threadId],
    'projectId',
  )
}
