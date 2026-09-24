# Task dashboard

The existing local Codex Triage app is the visual reference for this first public dashboard. This step connects its task-list layout to the public TanStack server snapshot. It does not add Jev controls, automation grouping, or archive actions.

## Acceptance criteria

- Initial load calls `getTaskSnapshot`; Refresh calls `refreshTaskSnapshot` explicitly and reports errors without hiding the last visible data.
- Active tasks show title, ID, project, update date, and pin state. Project names and pins come from the public snapshot.
- All, pinned, and unpinned views work with project filtering, title/project search, and 25-item pagination. Project and projectless counts reflect the selected pin view.
- English is the initial language. Users can choose Dutch; the choice persists in the browser. Dates, labels, empty states, and errors follow the choice.
- The selected dark desktop layout remains usable on a narrow mobile viewport, with keyboard-accessible filters and readable task rows.
- Loading, searching, filtering, refreshing, and changing language never start Jev analysis or archive a task.
