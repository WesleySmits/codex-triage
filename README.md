# Codex Triage

Codex Triage is an open-source project for reviewing and organizing Codex tasks locally. The dashboard lists active tasks from the local Codex app-server, with project and pin filters, search, and pagination. English is the default; Dutch is optional.

## Requirements

- Node.js 24
- pnpm 12.5.1 via Corepack

## Local setup

```sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open the local URL printed by Vite. The dashboard needs a working local `codex app-server` command to show tasks. It reports a sync error when that source is unavailable. Jev credentials are optional; no analysis runs from this dashboard yet.

## Jev analysis backend

For optional Jev analysis, copy `.env.example` to a local `.env` and set `TYPESAFE_API_KEY`, or set it in the server process environment. The key stays on the server and is never sent to the browser. Without a key, analysis cannot start. No TypeSafe request runs on page load or task refresh.

The backend exposes `startAnalysis`, `getAnalysisStatus`, `getAnalyses`, and `cancelAnalysis` server functions for a later dashboard step. `startAnalysis` requires an explicit list of current task IDs. It refreshes Codex state, then processes up to five tasks at a time. The status function reports completed, cached, analyzed, and failed counts, token usage, and elapsed time. A failed task does not stop the rest. Cancellation takes effect after the current batch. Analysis controls are not shown yet.

For each selected task, the server reads only the title, opening user request, and latest user and assistant text. It excludes tool output, attachments, and images. Before calling TypeSafe, it removes common links, email addresses, paths, and secret-like strings and caps each field. These are best-effort filters, so review your local task content before enabling external analysis. Jev 1.13 answers four yes/no questions about completion, open actions, relevance, and obsolescence. Fixed pilot thresholds convert those signals into `keep`, `review`, or `archive` advice. Confidence here is advisory and has not been calibrated on your tasks.

Results contain no message text and are stored only in ignored local `.data/analysis-v1.json`. They become stale when a task changes, its pin state changes, the model changes, or the advice rules are versioned again. Reanalyzing a current result uses the cache and spends no Jev tokens. Analysis has no archive operation. Archiving still requires a separate user-confirmed action.

## Checks

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm fallow
corepack pnpm build
```

ESLint enforces strict and stylistic type rules, import order, and small, simple files and functions. TypeScript checks unused names, return paths, and optional properties. Fallow checks dependency hygiene, code health, and duplication across the project. Lefthook runs staged lint and format checks and Fallow before commits, then Commitlint checks commit messages. Hooks check only; use `corepack pnpm lint:fix` or `corepack pnpm format` to apply fixes.

Class files contain one class plus imports and type declarations. Runtime helpers, schemas, and singleton instances live in separate modules. A local ESLint rule checks this for source and test files.

The generated route tree is committed so type checking works on a fresh checkout.

## Local Codex data

The server layer in `src/server` connects to `codex app-server --stdio`. It loads active tasks and projects, combines them with local pin and project state, and detects automation IDs in an automation run's opening text. A snapshot stays in server memory until the user explicitly refreshes it. No task data is saved by this project.

Server functions provide snapshot and refresh operations, archived task metadata for unarchive review, individual archive and unarchive, and a group archive operation for one Automation ID. Each write checks fresh local state first and reads the result back. A group call handles at most ten runs. The caller must review the returned snapshot before continuing; `partial` and `uncertain` results require manual reconciliation. The dashboard calls only snapshot and refresh; archive controls and automation grouping belong to later steps.

Vite development and preview bind to `127.0.0.1`. Server functions also reject requests whose URL or Host is outside loopback. Run any production server on loopback as well. Only an explicit Jev analysis sends minimized task text to TypeSafe.

The server code is split by responsibility:

- `codex-rpc.ts` owns the app-server process, request lifecycle, and pagination limits. `codex-protocol.ts` parses replies without process state. `codex-client.ts` maps task operations to RPC calls.
- `local-codex-state.ts` reads the bounded local state file. `task-normalization.ts` combines that state with Codex task and project listings.
- `archive-policy.ts` checks expected task versions and Automation ID groups. `archive-operations.ts` performs writes and readback. `task-store.ts` owns only the in-memory snapshot and mutation lock; `task-store-instance.ts` creates the shared instance.
- `archive-input.ts` validates write inputs, `local-request.ts` enforces loopback requests, and `functions.ts` exposes the TanStack server functions.

## License

MIT. See [LICENSE](LICENSE).
