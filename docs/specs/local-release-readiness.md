# Local release readiness

This PR documents the complete local user route after the dashboard, Jev controls, automation grouping, and reviewed archive actions. It does not change runtime behavior.

## Acceptance criteria

- A fresh checkout can activate the repository-pinned pnpm 12.5.1 with Corepack on Node.js 24, install from the frozen lockfile, run `pnpm check`, and start on loopback.
- The install guide explains the Codex app-server and local state dependencies, an optional server-side TypeSafe key, and common sync, sandbox, size, and stale-cache failures without asking users to expose credentials or task text.
- The privacy guide identifies exactly which selected text may leave the machine, the best-effort limits of redaction, local cache data and retention, and the explicit nature of Jev and archive actions.
- The user route covers active-task inspection, filters, automation runs, Jev advice, review and confirmation, bounded group batches, readback, reconciliation, and restore.
- Validation uses synthetic tests and read-only local browser interactions on desktop and a 390 px viewport. No real Jev call, Codex archive or restore, deployment, or publication is needed to prove this documentation change. Browser verification remains an open acceptance item until it runs.

## Verification record

- Node.js `v24.19.0`, Corepack pnpm `12.5.1`: `corepack pnpm install --frozen-lockfile` passed in this fresh worktree.
- After rebasing on the reviewed archive actions, `corepack pnpm install --frozen-lockfile` and `corepack pnpm check` passed: typecheck, ESLint, Prettier, 86 synthetic tests, Fallow, and client/server build. The base includes the 32 MiB local-state cap, persistent archive reconciliation marker, and restore pin-state checks.
- `corepack pnpm dev --host 127.0.0.1 --port 5189` served a read-only `GET /` with HTTP `200`, a rendered task table, and no sync-error marker. The first sandboxed attempt showed a sync error because the local Codex app-server lacked permission; repeating the same local server command with narrow approval restored the read route. No task names, IDs, or text were printed during this check.
- **Blocked:** The Codex in-app browser returned `Browser is not available: iab` when opening the local URL. Desktop and 390 px browser interactions are unverified. The HTTP check above proves only the server-rendered read route; it does not satisfy the browser acceptance item.
- No real Jev request, Codex archive or restore, deployment, or publication was run. Static checks and the loopback response do not prove those integrations on a real installation.
