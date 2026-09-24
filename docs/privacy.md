# Data and privacy

Codex Triage is a local dashboard. Its server reads active and archived task metadata from `codex app-server --stdio` and reads local pin and project state from `CODEX_HOME` or `~/.codex`. The task snapshot stays in server memory. Filtering, automation grouping, and the Archived view do not send task text to TypeSafe.

## Optional external analysis

Jev analysis is off until you configure `TYPESAFE_API_KEY`, select tasks, and click **Analyze selected**. For each selected task, the server reads its title, opening user request, latest user text, and latest final assistant text from Codex. Tool output, attachments, and images are excluded. The server trims these fields to 180, 600, 350, and 700 characters respectively, after removing common URLs, email addresses, user-home paths, token-like strings, and long code-like strings. This removal is **best effort**: sensitive text can survive. Review the tasks you select before sending them to TypeSafe. The TypeSafe API key is used only on the server and is not returned to the browser.

The model returns signals about whether the individual task or automation run is complete, still has an action, or is explicitly obsolete. Signal values and Keep/Review/Archive advice are not calibrated certainty. Analysis is advice; no Codex archive request is made from a Jev result. Loading, refreshing, searching, opening a group, or viewing cached advice does not start Jev. A current cached result avoids another Jev request when that task is explicitly analyzed again.

## Local storage and retention

- `.data/analysis-v1.json` stores task IDs, task version and pin metadata, model/rubric version, advice, signal values, token counts, and timing. It does not store message text. The file is ignored by Git and written with restrictive local permissions.
- An old cache entry remains available as **stale** when its task, pin state, model, or rubric version changes. The app does not automatically purge it. A new explicit analysis replaces that task's cache entry.
- The browser stores the chosen English or Dutch language and a task-free pending archive marker in local storage. The marker survives a page reload until a verified result or explicit reconciliation clears it. It does not store the TypeSafe key or task content there.
- Local `.env` files are ignored by Git. Keep them private and remove credentials from any logs, screenshots, or support request you choose to share.

## Codex archive writes

Archive and restore are separate, human-confirmed actions through the local Codex app-server. The server checks the task's expected timestamp and pin state before writing and reads back the outcome. An automation group includes its newest and pinned runs if you confirm the group action; at most ten runs are sent per batch. A `continue` result requires another review and confirmation. `partial`, `uncertain`, `stale`, and `busy` stop the workflow. If the response is lost or the page closes during a write, the browser keeps actions locked across reloads. Refresh both active and archived lists and acknowledge reconciliation before another action. Browser storage must be available to start a write.

There is no automatic archive based on Jev advice. The application does not upload the local cache or task snapshot as part of installation or testing.
