# Codex Triage

Codex Triage is a local dashboard for reviewing your Codex tasks. It reads the Codex app-server on your computer, helps you find tasks and automation runs, and makes archiving a deliberate, reviewable action. Optional Jev analysis offers advice for tasks you select.

## What it does

- Lists active tasks with search, project and pin filters, pagination, and English or Dutch labels.
- Groups runs of the same automation so you can review the group and its individual runs.
- Shows optional Keep, Review, or Archive advice with progress, token use, cached results, and stale-result labels. You choose which tasks to analyze.
- Lets you confirm individual archive and restore actions. A group archive handles at most ten runs per confirmation and asks you to review the next batch. Writes use fresh-state checks and readback. Uncertain outcomes lock further actions until you refresh both lists and acknowledge reconciliation.

## Current limits

- This is a local app, not a hosted task sync service. It needs a working `codex app-server --stdio` command and access to your Codex state as the same operating-system user.
- Jev advice is optional and uncalibrated. It never archives a task for you. Text minimization before an external analysis request is best effort, so review what you select.
- Archive and restore need your confirmation. The app does not automatically archive old runs or resolve an uncertain write for you.

## Run locally

Use Node.js 24 and the pnpm version pinned in `package.json` (currently 12.5.1) through Corepack. Make sure `codex` is on your `PATH` and can run `codex app-server --stdio` for the same user who owns your Codex tasks.

```sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open the loopback URL printed by Vite, normally `http://127.0.0.1:5173/`. Development and preview bind to `127.0.0.1`; keep any production server on loopback too. If the dashboard shows a sync error, check Codex app-server access and local filesystem or sandbox permissions. See the [installation and troubleshooting guide](docs/installation.md). The local Codex state reader has a 32 MiB file limit.

## Optional Jev analysis

Copy `.env.example` to `.env` and set `TYPESAFE_API_KEY`, or provide the key in the server process environment. Keep it out of commits and logs. Without a key, analysis is disabled. With a key, selecting tasks and clicking **Analyze selected** sends bounded text from only those tasks to TypeSafe. Page load, refresh, search, and archive review do not start Jev analysis.

The server excludes tools, attachments, and images, and removes common links and identifiers before sending text. This filtering can miss sensitive content. Advice and task IDs are cached in ignored local `.data/analysis-v1.json`; message text is not saved there. Read the [privacy guide](docs/privacy.md) before enabling analysis. The [analysis rubric](docs/specs/analysis-rubric.md) explains how signals become advice.

## Reviewed archive actions

**Archive** opens a review of the task identity and pin status; confirmation is a separate click. **Archive all runs** includes the newest and pinned runs in the group. The Archived view loads on request and offers individual restore with confirmation. Before any write, the browser saves a task-free pending marker. If a response is lost or a result is uncertain, the marker blocks another write across page reloads until you refresh the active and archived lists and acknowledge reconciliation. A reload does not preserve the receipt or confirmed IDs. Compare current task states before acting again.

## Contributing

Open a focused pull request with a clear description and run `corepack pnpm check` before submitting. That command covers TypeScript, lint, formatting, tests, Fallow, and the build. Use synthetic task data in tests and reports; do not include your Codex task text, API keys, or local cache. The repo uses conventional commit titles such as `fix(ui): explain an uncertain result`.

## License

MIT. See [LICENSE](LICENSE).
