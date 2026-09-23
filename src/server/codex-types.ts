export interface CodexThread {
  id: string
  name: string | null
  preview: string
  projectId: string | null
  createdAt: number | null
  updatedAt: number
}

export interface CodexProject {
  id: string
  name: string
}

export interface CodexClientLike {
  connect(): Promise<void>
  close(): void
  listActiveThreads(): Promise<CodexThread[]>
  listArchivedThreads(): Promise<CodexThread[]>
  listArchivedIds(): Promise<Set<string>>
  listProjects(): Promise<CodexProject[]>
  readOpeningUserText(threadId: string): Promise<string | null>
  archiveThread(threadId: string): Promise<void>
  unarchiveThread(threadId: string): Promise<void>
}
