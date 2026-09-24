# Reviewed archive actions

The dashboard lets Wesley archive or restore local Codex tasks only after an explicit confirmation. Jev advice remains informational. Archive actions use expected-state checks and provider readback.

## Behavior

- Each active task and automation run has an Archive button. It opens a native modal `<dialog>` with the task identity and pin status. Cancel and Escape close it and return focus to the trigger. Confirmation invokes `archiveTask` once with the displayed task's expected state.
- The shared selection can be used for analysis or Archive selected. The dialog lists the first ten task names, the total selected count, and the pinned count. A selected-batch confirmation invokes `archiveSelectedTasks` once. The server checks the expected timestamp and pin state of the entire selected set against a fresh snapshot, then writes at most ten tasks. A `continue` receipt keeps the remaining selected tasks available for a separate review and confirmation using the returned snapshot.
- An automation card can archive all its runs, including the newest and pinned runs. The review states the total and pinned counts and passes the full current group to `archiveAutomationGroup`. The server writes at most ten per call.
- A `continue` response shows confirmed IDs/count and the remaining tasks or runs from the returned fresh snapshot. The next batch requires a new review click and confirmation. There is no automatic loop.
- Before each write, the browser stores and verifies a minimal pending marker with no task data. If browser storage is unavailable, no write starts. A verified `complete` or `continue` result with a fresh snapshot clears the marker.
- `partial`, `uncertain`, `stale`, and `busy` stop the flow. A lost response or page unload during a write leaves the marker in place. Reloading restores the lock. Another write stays locked until the user refreshes both active and archived lists and acknowledges the reconciliation. The receipt and error remain visible until a new request within the same page session. Other open tabs lock when they receive the browser storage event; simultaneous cross-tab clicks cannot be serialized atomically by local storage.
- The Archived view loads `getArchivedTasks` on request. Each archived task can be restored individually after confirmation through `unarchiveTask`. The server verifies expected archived timestamps and pin state before the write, then verifies active timestamps and pin state on readback; the result is shown before another action.
- Loading, filtering, refreshing, analysis, and visiting the Archived view never mutate Codex tasks. Tests use synthetic tasks and do not call the real Codex archive functions.
