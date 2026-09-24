# Automation groups

The dashboard adds a read-only Automation view for active runs. It uses only the `automationId` already validated in the task snapshot. A task with no valid ID remains an ordinary task and never enters an automation group.

## Acceptance criteria

- Group active runs by exact Automation ID. The newest run is the one with the latest creation timestamp, then update timestamp, then task ID for deterministic ties. Its summary stays visible even when a pin, project, or search filter hides that run from the matching run list.
- Show the newest run's date and cached Jev advice, and let users expand each group to inspect and select individual runs for the existing explicit analysis action. The newest run is marked for retention in this view; this step offers no archive control.
- Show distinct _additional signal types_ found in current analyses of matching older runs but absent from the newest run's current analysis. A type counts when its v2 score is at least 0.7. Stale and missing analyses add no signal. These are model signals, not issue or content deduplication and not calibrated certainty.
- All, pinned, unpinned, project, and search filters determine which runs appear and the matching run count. A group appears only when it has at least one matching run. Project sidebar counts continue to reflect the selected pin view.
- English and Dutch have group labels and empty states. Loading, filtering, and opening a group never start Jev or archive anything.
