# Local installation

Codex Triage runs on your computer and reads tasks through the local Codex app-server. Use a machine where the `codex` command and your Codex task state are already available. The application is not a hosted service.

## Requirements

- Node.js 24 (`node --version`)
- Corepack and the repository-pinned pnpm 12.5.1
- A working `codex app-server --stdio` command on your `PATH`
- Read access, as the same operating-system user, to Codex's local state under `CODEX_HOME` or `~/.codex`

Run these commands from the repository root:

```sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open the loopback URL printed by Vite, normally `http://127.0.0.1:5173/`. Vite binds development and preview to `127.0.0.1`, and server functions reject remote or cross-site requests. Keep any production server on loopback too. Do not expose this app through a public host or tunnel.

The first page load reads active tasks. **Refresh** fetches a fresh snapshot. You can search, filter, switch language, inspect automation runs, and open the Archived view without changing Codex tasks or contacting Jev.

## Optional Jev analysis

Analysis requires a TypeSafe API key. Copy `.env.example` to `.env` and set `TYPESAFE_API_KEY` there, or set it in the server process environment. Keep the key out of commands, screenshots, issue reports, and commits. `.env*` is ignored except `.env.example`. Restart the development server after changing its environment.

The key stays server-side. Analysis starts only after selecting tasks and clicking **Analyze selected**. The dashboard then shows progress, cached results, failed counts, token use, and current or stale advice. **Cancel run** stops after the current batch. Without a key, analysis is disabled. See [privacy](privacy.md) before enabling it.

## Archive and restore

Jev advice never archives a task. **Archive** on a task or automation run opens a review with its identity and pin status. **Archive all runs** reviews the full automation group, including pinned and newest runs. Confirming is a separate click. A group writes at most ten runs per confirmation; a `continue` result offers another review for the remainder. The Archived view loads on request and offers individual restore with its own confirmation.

Before a write, the browser saves a task-free pending marker in local storage. If storage is unavailable, the write does not start. A confirmed `complete` or `continue` result with a fresh snapshot clears the marker. For `partial`, `uncertain`, `stale`, or `busy`, the marker keeps further archive and restore actions locked, even after a page reload. A lost response or page unload during a write also keeps the lock. Refresh both active and archived lists, compare the confirmed IDs with Codex, then explicitly acknowledge reconciliation before another action. Do not blindly repeat a request. See [privacy](privacy.md) for the data involved.

## Troubleshooting

| Symptom                                | Check                                                                                                                                          | Next step                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Sync failed or no tasks                | Check `command -v codex`, that the local app-server starts for your user, and that `CODEX_HOME` points to the intended Codex home.             | Run locally with the intended user and access. Refresh after resolving the cause.                                 |
| Local state size error                 | The reader rejects `.codex-global-state.json` above 32 MiB before parsing. Check its byte size with `stat` without printing the file contents. | Do not delete or truncate Codex state. Report the size without sharing the file contents.                         |
| Permission or sandbox error            | The process may be unable to execute Codex or read its home directory.                                                                         | Run the app in an authorized local environment; avoid granting broad filesystem access merely to clear the error. |
| Jev unavailable                        | Check that `TYPESAFE_API_KEY` is present in the server process and restart it.                                                                 | Leave analysis disabled if no key is intended.                                                                    |
| Analysis result is stale               | Task update, pin state, model, or rubric changed.                                                                                              | Select the task and start a new analysis if advice is still needed.                                               |
| Archive result is partial or uncertain | A write or readback did not fully confirm the requested result.                                                                                | Reconcile active and archived lists before another archive or restore action.                                     |
| Archive actions stay locked            | A prior write is unresolved, or browser local storage is unavailable.                                                                          | Refresh both lists and acknowledge reconciliation; enable local storage if it is unavailable.                     |

`corepack pnpm check` runs the repository's type, lint, formatting, test, static-analysis, and build checks. Those checks use synthetic tasks; they do not call live Jev or archive your Codex tasks.
