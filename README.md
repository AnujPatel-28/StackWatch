# StackWatch

StackWatch is a documentation intelligence layer for software projects.

> Don&apos;t monitor documentation. Monitor what it means for your code.

This repository is the StackWatch application. It is intentionally separate from the controlled public documentation fixture in `stackwatch-demo-docs`, which is not modified here.

## Current MVP vertical slice

The first slice contains:

- A Next.js App Router application using TypeScript and Tailwind CSS.
- A simple StackWatch landing page at `/`.
- A live dashboard at `/dashboard` with source input, scrape status, quality breakdown, baseline status, change severity, notification delivery, healing progress, and snapshot history.
- A server-only Bright Data Scraper Studio adapter that triggers the configured collector, polls for a result, and never exposes the API key to browser code.
- A normalized documentation snapshot schema and deterministic extraction quality evaluator.
- A `POST /api/scrape` route that validates public HTTP(S) documentation URLs, runs the configured collector, persists the result, and reports only meaningful healthy changes.
- Server-side Telegram delivery for documentation changes, extraction degradation, and confirmed recovery.
- Bright Data self-healing routes: start a repair, poll its real approval gate, approve it, then re-run the same collector to verify recovery.
- Provider-agnostic TypeScript contracts under `lib/` for the future server-side workflow.
- Domain types for projects, technologies, documentation sources and snapshots, extraction health, changes, impact assessments, recommendations, and notifications.
- An environment variable example with reserved integration names.

Bright Data and the snapshot repository boundary are load-bearing. Development uses an isolated in-memory repository when `SNAPSHOT_REPOSITORY=memory`; InsForge/PostgreSQL persistence is available when configured. Telegram and self-healing are server-side integrations. Gemini explanation remains optional and is deliberately not enabled without a verified model/key.

## Architecture

The application stays in one Next.js repository. Server-side routes and services can be added inside this app when the first real workflow is implemented.

```text
app/                    UI and future server-side routes
components/ui/          Reusable presentation components
lib/types/              Shared domain types
lib/scraper/            Scraping contracts, Bright Data adapter, normalization, quality
lib/snapshots/          Snapshot persistence contracts
lib/change-detection/  Deterministic structured change detection
lib/healing/           HMR-safe in-process healing job store
lib/impact-analysis/    Project impact contracts
lib/notifications/      Telegram message builders and delivery client
lib/projects/           Project persistence contracts
app/api/scrape/         Manual scrape endpoint
app/api/heal/           Bright Data healing start, status, and approval endpoints
app/api/history/        Minimal persisted snapshot history endpoint
lib/snapshots/          Snapshot record, repository, comparison, and development adapter
```

## Local development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) or [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

## Validation

```bash
npm run typecheck
npm run build
npm test
```

## Snapshot persistence

The scrape route retrieves the latest snapshot before triggering Bright Data, compares the new normalized result against the last healthy baseline, and saves successful normalized results with their quality metadata. Failed or malformed results are not saved. Degraded snapshots remain in history but can never replace the last good baseline; a recovery is always compared to that healthy record.

`SNAPSHOT_REPOSITORY=memory` is a development-only process-local repository. It is not durable across restarts. For real persistence:

1. Apply `migrations/20260823150000_create-snapshot-records.sql` to the linked InsForge project.
2. Set the server-only `INSFORGE_URL` and `INSFORGE_API_KEY` values.
3. Set `SNAPSHOT_REPOSITORY=insforge`.

The InsForge adapter retrieves the latest non-failed and latest healthy records by `source_url`, ordered by `created_at` and `id`, and stores the normalized snapshot plus quality metadata. Its history query uses the same ordering. Failed results are rejected by the repository and are also excluded by the scrape workflow; healthy, partial, and degraded snapshots may be retained as historical evidence.

## Bright Data API assumption

The adapter follows the requested async real-time flow: `POST /dca/trigger_immediate?collector=<collector>` with `{ "url": "..." }`, then `GET /dca/get_result?response_id=<id>` until a non-pending result is returned. Bright Data documentation also describes other Scraper Studio collection modes, including batch `collection_id` plus `/dca/dataset`; if collector delivery settings require that mode, the adapter’s result polling contract will need to be adjusted before production use.

## Bright Data healing workflow

When a scrape is degraded, start a repair from the dashboard. StackWatch posts the repair prompt to Bright Data, polls the real progress endpoint until Bright Data exposes the approval gate, then re-runs the same collector after approval. Recovery is accepted only when the re-run is healthy.

The equivalent operator workflow remains available for the controlled fixture:

```bash
bdata scraper run c_mt4k8bvwaxtcnj8s8
bdata scraper heal c_mt4k8bvwaxtcnj8s8 "Describe the fixture structure change"
bdata scraper approve c_mt4k8bvwaxtcnj8s8
bdata scraper run c_mt4k8bvwaxtcnj8s8
```

## Limitations

- One Bright Data collector is configured per source. Multi-source collection is out of scope because the collector is bound to its source structure.
- Gemini explanation is optional and not enabled until a configured key and verified model are available.
