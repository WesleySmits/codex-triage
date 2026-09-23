# Codex Triage

Codex Triage is an open-source project for reviewing and organizing Codex tasks locally. The application is under development; the current page is a minimal project foundation.

## Requirements

- Node.js 24
- pnpm 12.5.1 via Corepack

## Local setup

```sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open the local URL printed by Vite. No credentials or Codex data are needed for this foundation.

## Checks

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm fallow
corepack pnpm build
```

ESLint enforces strict and stylistic type rules, import order, and small, simple files and functions. TypeScript checks unused names, return paths, and optional properties. Fallow checks dependency hygiene, code health, and duplication across the project. Lefthook runs staged lint and format checks and Fallow before commits, then Commitlint checks commit messages. Hooks check only; use `corepack pnpm lint:fix` or `corepack pnpm format` to apply fixes.

The generated route tree is committed so type checking works on a fresh checkout.

## Local Codex data

The server layer in `src/server` connects to `codex app-server --stdio`. It loads active tasks and projects, combines them with local pin and project state, and detects automation IDs in an automation run's opening text. A snapshot stays in server memory until the user explicitly refreshes it. No task data is saved by this project.

Server functions provide snapshot and refresh operations, archived task metadata for unarchive review, individual archive and unarchive, and a group archive operation for one Automation ID. Each write checks fresh local state first and reads the result back. A group call handles at most ten runs. The caller must review the returned snapshot before continuing; `partial` and `uncertain` results require manual reconciliation. These functions are ready for a future UI and are not connected to the foundation page yet.

Vite development and preview bind to `127.0.0.1`. Server functions also reject requests whose URL or Host is outside loopback. Run any production server on loopback as well. The app does not send task data to an external service.

## License

MIT. See [LICENSE](LICENSE).
