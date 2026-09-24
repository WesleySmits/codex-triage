import type { CodexClientLike, CodexThread } from './codex-types'

export class FakeClient implements CodexClientLike {
  active: CodexThread[] = []
  archived: CodexThread[] = []
  writes: string[] = []
  failWrite: string | null = null
  failReadback = false
  openingText: string | null = null

  connect() {
    return Promise.resolve()
  }
  close() {
    return undefined
  }
  listActiveThreads() {
    return Promise.resolve(this.active)
  }
  listArchivedThreads() {
    return Promise.resolve(this.archived)
  }
  listArchivedIds() {
    if (this.failReadback) throw new Error('simulated readback failure')
    return Promise.resolve(new Set(this.archived.map((item) => item.id)))
  }
  listProjects() {
    return Promise.resolve([
      { id: 'synthetic-project', name: 'Example project' },
    ])
  }
  readOpeningUserText() {
    return Promise.resolve(this.openingText)
  }
  archiveThread(id: string) {
    this.writes.push(id)
    if (this.failWrite === id) throw new Error('simulated write failure')
    const task = this.active.find((item) => item.id === id)
    if (task) {
      this.active = this.active.filter((item) => item.id !== id)
      this.archived.push(task)
    }
    return Promise.resolve()
  }
  unarchiveThread(id: string) {
    this.writes.push(id)
    const task = this.archived.find((item) => item.id === id)
    if (task) {
      this.archived = this.archived.filter((item) => item.id !== id)
      this.active.push(task)
    }
    return Promise.resolve()
  }
}
