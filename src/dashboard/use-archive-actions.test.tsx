import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ArchivePanel } from './archive-panel'
import { useArchiveActions } from './use-archive-actions'

function InitialArchiveView() {
  const archive = useArchiveActions(() => undefined)
  return createElement(
    'div',
    null,
    createElement(ArchivePanel, {
      archive,
      language: 'en',
      onRefreshActive: () => undefined,
      refreshing: false,
    }),
    createElement('button', {
      disabled: archive.reconciliation.required,
      type: 'button',
    }),
  )
}

describe('initial archive render', () => {
  it('hides reconciliation warning while storage is unchecked and keeps writes locked', () => {
    const html = renderToStaticMarkup(createElement(InitialArchiveView))
    expect(html).not.toContain('class="notice error"')
    expect(html).toContain('disabled=""')
  })
})
