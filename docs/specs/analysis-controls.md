# Explicit Jev analysis controls

This change adds Jev controls to the existing task dashboard. Jev advice is informational; archiving is a separate, later feature.

## Acceptance criteria

- Dashboard load and task refresh may read analysis status and cached advice. Neither starts Jev work. Only an explicit click on **Analyze selected** calls `startAnalysis`.
- A user can select tasks across filters and pages, see the selection count, and clear it. Missing IDs are removed after a refreshed snapshot and excluded from the submitted payload.
- Start is unavailable for empty selections, missing TypeSafe configuration, an active run, or a pending request. Start errors appear in the dashboard.
- Running status is polled while a run is active. Show completed/total, newly analyzed, cached, failed, token use, elapsed time, and cancellation. Cancellation takes effect after the current batch.
- Current and stale cached advice is shown on each task row. Labels and privacy/advisory copy are available in English and Dutch.
- No archive action is triggered by loading, refreshing, or analyzing.
