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

Bright Data is the only connected product integration in this slice. There is no database persistence, AI analysis, Telegram, authentication, automatic healing, scheduling, or background job system. The scrape result is normalized in memory and returned to the caller only.

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

## Bright Data API assumption

The adapter follows the requested async real-time flow: `POST /dca/trigger_immediate?collector=<collector>` with `{ "url": "..." }`, then `GET /dca/get_result?response_id=<id>` until a non-pending result is returned. Bright Data documentation also describes other Scraper Studio collection modes, including batch `collection_id` plus `/dca/dataset`; if collector delivery settings require that mode, the adapter’s result polling contract will need to be adjusted before production use.

## Next implementation step

Persist the normalized snapshot and quality result after this manual scrape succeeds. Add a database migration only once the InsForge/PostgreSQL project configuration is available.
