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

## License

MIT. See [LICENSE](LICENSE).
