import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { Task } from '../server/task-types'
import { TaskTable } from './task-table'
import type { AnalysisControls } from './use-analysis'
import type { ArchiveControls } from './use-archive-actions'

const task: Task = {
  id: 'example',
  title: 'Example',
  createdAt: Date.UTC(2020, 0, 2, 12) / 1000,
  updatedAt: Date.UTC(2020, 0, 3, 12) / 1000,
  pinned: false,
  projectId: 'north',
  projectName: 'North',
  automationId: null,
}

const analysis: AnalysisControls = {
  status: null,
  views: [],
  selected: [],
  busy: false,
  error: null,
  toggle: vi.fn(),
  selectFiltered: vi.fn(),
  deselectFiltered: vi.fn(),
  clear: vi.fn(),
  start: vi.fn(),
  cancel: vi.fn(),
  reload: vi.fn(),
}

const archive: ArchiveControls = {
  pending: null,
  receipt: null,
  busy: false,
  error: null,
  archived: [],
  archivedLoaded: false,
  reconciliation: {
    required: false,
    activeReviewed: false,
    archivedReviewed: false,
    reviewVersion: null,
  },
  storageChecked: true,
  canAcknowledge: false,
  acknowledgeReconciliation: vi.fn(),
  reviewedActiveSnapshot: vi.fn(),
  request: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  reviewRemaining: vi.fn(),
  loadArchived: vi.fn(),
}

describe('task table sort context', () => {
  it('shows the date used for ordering and names each project table', () => {
    const render = (sort: 'recent' | 'created-newest') =>
      renderToStaticMarkup(
        createElement(TaskTable, {
          tasks: [task],
          sort,
          caption: 'Active Codex tasks · North',
          language: 'en',
          analysis,
          archive,
        }),
      )
    const recent = render('recent')
    expect(recent).toContain('Active Codex tasks · North')
    expect(recent).toContain('Updated</th>')
    expect(recent).toContain('Jan 3, 2020')
    const created = render('created-newest')
    expect(created).toContain('Created</th>')
    expect(created).toContain('Jan 2, 2020')
    expect(created).not.toContain('Jan 3, 2020')
  })
})
