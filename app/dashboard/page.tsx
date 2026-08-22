import Link from "next/link";
import { StatusCard } from "@/components/ui/status-card";
import { RunScraperControl } from "@/components/scraper/run-scraper-control";

const statusCards = [
  { label: "Documentation sources", value: "0 connected", detail: "Add your first source when ingestion is ready.", tone: "mint" as const },
  { label: "Last scrape", value: "Not run", detail: "Scraping boundary is ready for an adapter.", tone: "ink" as const },
  { label: "Extraction health", value: "Unconfigured", detail: "No extraction provider is connected yet.", tone: "teal" as const },
  { label: "Changes detected", value: "—", detail: "Change detection will follow snapshots.", tone: "coral" as const },
  { label: "Project impact", value: "—", detail: "Impact analysis will follow detected changes.", tone: "mint" as const },
  { label: "Notifications", value: "Not connected", detail: "Notification delivery is intentionally unconfigured.", tone: "ink" as const },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-mist">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-ink/10 pb-8">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-mint">S</span>
            StackWatch
          </Link>
          <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">MVP preview</span>
        </header>

        <section className="py-14">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal">Overview</p>
          <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">Don&apos;t monitor documentation.</h1>
              <p className="mt-3 text-lg text-ink/60">Monitor what it means for your code.</p>
            </div>
            <p className="max-w-xs text-sm leading-6 text-ink/50">A calm starting point for documentation change intelligence. Connect real sources when the next slice is ready.</p>
          </div>
        </section>

        <section aria-label="MVP status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statusCards.map((card) => <StatusCard key={card.label} {...card} />)}
        </section>

        <RunScraperControl />

        <section className="mt-8 rounded-2xl border border-ink/10 bg-ink p-6 text-white shadow-soft sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-mint">Foundation status</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">The product surface is ready for real signals.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">The MVP currently defines the dashboard and server-side integration contracts. External scraping, persistence, AI analysis, and delivery remain intentionally disconnected.</p>
            </div>
            <span className="shrink-0 rounded-full bg-mint px-4 py-2 text-sm font-semibold text-ink">Foundation only</span>
          </div>
        </section>
      </div>
    </main>
  );
}
