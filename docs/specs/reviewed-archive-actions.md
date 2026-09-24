# Reviewed archive actions

The dashboard lets Wesley archive or restore a local Codex task only after an explicit confirmation. Jev advice remains informational. This feature reuses the existing server functions and their expected-state checks and provider readback.

## Behavior

- Each active task and automation run has an Archive button. It opens an inline review with the task identity and pin status. Confirmation invokes `archiveTask` once with the displayed task's expected state.
- An automation card can archive all its runs, including the newest and pinned runs. The review states the total and pinned counts and passes the full current group to `archiveAutomationGroup`. The server writes at most ten per call.
- A `continue` response shows confirmed IDs/count and the remaining runs from the returned fresh snapshot. The next batch requires a new click on Review remaining runs and a new confirmation. There is no automatic loop.
- `partial`, `uncertain`, `stale`, and `busy` stop the flow. A lost response also stops without retry. Another write stays locked until the user refreshes both active and archived lists and acknowledges the reconciliation. The receipt and error remain visible until a new request.
- The Archived view loads `getArchivedTasks` on request. Each archived task can be restored individually after confirmation through `unarchiveTask`. The server verifies expected archived timestamps and pin state before the write, then verifies active timestamps and pin state on readback; the result is shown before another action.
- Loading, filtering, refreshing, analysis, and visiting the Archived view never mutate Codex tasks. Tests use synthetic tasks and do not call the real Codex archive functions.
