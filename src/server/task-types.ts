export interface Task {
  id: string
  title: string | null
  createdAt: number
  updatedAt: number
  pinned: boolean
  projectId: string | null
  projectName: string | null
  automationId: string | null
}

export interface Project {
  id: string
  name: string | null
}

export interface Snapshot {
  tasks: Task[]
  projects: Project[]
  refreshedAt: number | null
  error: string | null
}

export interface ExpectedTask {
  id: string
  createdAt: number
  updatedAt: number
  pinned: boolean
}

export type ArchiveStatus =
  'complete' | 'continue' | 'partial' | 'uncertain' | 'stale' | 'busy'

export interface ArchiveResult {
  status: ArchiveStatus
  confirmedIds: string[]
  snapshot: Snapshot
}

export type ArchiveOutcome = Pick<ArchiveResult, 'status' | 'confirmedIds'>
