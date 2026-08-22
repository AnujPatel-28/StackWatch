# StackWatch

StackWatch is a documentation intelligence layer for software projects.

> Don&apos;t monitor documentation. Monitor what it means for your code.

This repository is the StackWatch application. It is intentionally separate from the controlled public documentation fixture in `stackwatch-demo-docs`, which is not modified here.

## Current MVP foundation

The first slice contains:

- A Next.js App Router application using TypeScript and Tailwind CSS.
- A simple StackWatch landing page at `/`.
- A minimal dashboard at `/dashboard` with structured status cards for documentation sources, scraping, extraction health, detected changes, project impact, and notifications.
- Provider-agnostic TypeScript contracts under `lib/` for the future server-side workflow.
- Domain types for projects, technologies, documentation sources and snapshots, extraction health, changes, impact assessments, recommendations, and notifications.
- An environment variable example with reserved integration names.

The dashboard data is presentation-only. Bright Data or another scraper, InsForge/PostgreSQL, AI analysis, and Telegram are not connected yet, and there are no fake implementations for them.

## Architecture

The application stays in one Next.js repository. Server-side routes and services can be added inside this app when the first real workflow is implemented.

```text
app/                    UI and future server-side routes
components/ui/          Reusable presentation components
lib/types/              Shared domain types
lib/scraper/            Scraping contracts
lib/snapshots/          Snapshot persistence contracts
lib/change-detection/  Snapshot comparison contracts
lib/impact-analysis/    Project impact contracts
lib/notifications/      Delivery contracts
lib/projects/           Project persistence contracts
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
```

## Next implementation step

Connect one real documentation source through a server-side scraper adapter, persist its normalized snapshots, and expose the first read-only source status on the dashboard. Add a database migration only once the InsForge/PostgreSQL project configuration is available.
