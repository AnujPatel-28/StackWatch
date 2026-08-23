import Link from "next/link";
import { RunScraperControl } from "@/components/scraper/run-scraper-control";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-mist">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-ink/10 pb-8">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-mint">S</span>
            StackWatch
          </Link>
          <span className="rounded-full border border-teal/20 bg-teal/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-teal">Live monitor</span>
        </header>

        <section className="py-14">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal">Overview</p>
          <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">Don&apos;t monitor documentation.</h1>
              <p className="mt-3 text-lg text-ink/60">Monitor what it means for your code.</p>
            </div>
            <p className="max-w-xs text-sm leading-6 text-ink/50">Run the configured Bright Data collector to capture a baseline, surface documentation changes, and recover degraded extraction.</p>
          </div>
        </section>

        <RunScraperControl />
      </div>
    </main>
  );
}
