import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { ArchivePanel } from './archive-panel'
import type { ArchiveControls } from './use-archive-actions'

function archiveControls(canAcknowledge: boolean): ArchiveControls {
  return {
    pending: null,
    receipt: null,
    busy: false,
    error: null,
    archived: [],
    archivedLoaded: false,
    reconciliation: {
      required: true,
      activeReviewed: canAcknowledge,
      archivedReviewed: canAcknowledge,
    },
    storageChecked: true,
    canAcknowledge,
    acknowledgeReconciliation: vi.fn(),
    reviewedActiveSnapshot: vi.fn(),
    request: vi.fn(),
    cancel: vi.fn(),
    confirm: vi.fn(),
    reviewRemaining: vi.fn(),
    loadArchived: vi.fn(),
  }
}

describe('archive reconciliation notice', () => {
  it('shows both refresh actions and unlocks acknowledgment only after both reviews', () => {
    const pending = renderToStaticMarkup(
      createElement(ArchivePanel, {
        archive: archiveControls(false),
        language: 'en',
        onRefreshActive: vi.fn(),
        refreshing: false,
      }),
    )
    expect(pending).toContain('Refresh active list')
    expect(pending).toContain('Refresh archived list')
    expect(pending).toContain('disabled=""')

    const reviewed = renderToStaticMarkup(
      createElement(ArchivePanel, {
        archive: archiveControls(true),
        language: 'en',
        onRefreshActive: vi.fn(),
        refreshing: false,
      }),
    )
    expect(reviewed).not.toContain('disabled=""')
  })
})
