# StackWatch

StackWatch is a documentation intelligence layer for software projects.

> Don&apos;t monitor documentation. Monitor what it means for your code.

This repository is the StackWatch application. It is intentionally separate from the controlled public documentation fixture in `stackwatch-demo-docs`, which is not modified here.

## Current MVP vertical slice

The first slice contains:

- A Next.js App Router application using TypeScript and Tailwind CSS.
- A simple StackWatch landing page at `/`.
- A minimal dashboard at `/dashboard` with structured status cards for documentation sources, scraping, extraction health, detected changes, project impact, and notifications.
- A server-only Bright Data Scraper Studio adapter that triggers the configured collector, polls for a result, and never exposes the API key to browser code.
- A normalized documentation snapshot schema and deterministic extraction quality evaluator.
- A read-only `POST /api/scrape` route and a dashboard `Run Scraper` control with loading, success/failure, quality, counts, and preview states.
- Provider-agnostic TypeScript contracts under `lib/` for the future server-side workflow.
- Domain types for projects, technologies, documentation sources and snapshots, extraction health, changes, impact assessments, recommendations, and notifications.
- An environment variable example with reserved integration names.

Bright Data and the snapshot repository boundary are present in this slice. Development uses an isolated in-memory repository when `SNAPSHOT_REPOSITORY=memory`; no InsForge/PostgreSQL adapter is configured yet. There is no AI analysis, Telegram, authentication, automatic healing, scheduling, or background job system.

## Architecture

The application stays in one Next.js repository. Server-side routes and services can be added inside this app when the first real workflow is implemented.

```text
app/                    UI and future server-side routes
components/ui/          Reusable presentation components
lib/types/              Shared domain types
lib/scraper/            Scraping contracts, Bright Data adapter, normalization, quality
lib/snapshots/          Snapshot persistence contracts
lib/change-detection/  Snapshot comparison contracts
lib/impact-analysis/    Project impact contracts
lib/notifications/      Delivery contracts
lib/projects/           Project persistence contracts
app/api/scrape/         Manual read-only scrape endpoint
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

The scrape route retrieves the latest snapshot before triggering Bright Data, compares the new normalized result against it, and saves successful normalized results with their quality metadata. Failed or malformed results are not saved as baselines.

`SNAPSHOT_REPOSITORY=memory` is a development-only process-local repository. It is not durable across restarts or safe as production persistence. A production InsForge/PostgreSQL adapter still requires database configuration and an implementation of `SnapshotRepository`.

## Bright Data API assumption

The adapter follows the requested async real-time flow: `POST /dca/trigger_immediate?collector=<collector>` with `{ "url": "..." }`, then `GET /dca/get_result?response_id=<id>` until a non-pending result is returned. Bright Data documentation also describes other Scraper Studio collection modes, including batch `collection_id` plus `/dca/dataset`; if collector delivery settings require that mode, the adapter’s result polling contract will need to be adjusted before production use.

## Next implementation step

Replace the development repository with a real InsForge/PostgreSQL `SnapshotRepository` once database configuration is available.
