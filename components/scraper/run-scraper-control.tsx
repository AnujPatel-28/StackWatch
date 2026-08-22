"use client";

import { useState } from "react";
import type { ScrapeApiResponse } from "@/lib/scraper/types";

type RunState = "idle" | "loading" | "success" | "error";

export function RunScraperControl() {
  const [runState, setRunState] = useState<RunState>("idle");
  const [response, setResponse] = useState<ScrapeApiResponse | null>(null);
  const [error, setError] = useState("");

  async function runScraper() {
    setRunState("loading");
    setResponse(null);
    setError("");
    try {
      const result = await fetch("/api/scrape", { method: "POST" });
      const body = await result.json() as ScrapeApiResponse;
      if (!result.ok || !body.success) {
        setRunState("error");
        setError(body.success ? "The scrape failed." : body.error);
        return;
      }
      setResponse(body);
      setRunState("success");
    } catch {
      setRunState("error");
      setError("Could not reach the StackWatch scrape endpoint.");
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-teal/20 bg-white p-6 shadow-soft sm:p-8" aria-labelledby="scraper-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal">Manual operator action</p>
          <h2 id="scraper-title" className="mt-2 text-2xl font-semibold tracking-tight text-ink">Run the documentation scraper</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/55">Triggers the configured Bright Data collector and returns a normalized, read-only preview. No snapshot is persisted.</p>
        </div>
        <button type="button" onClick={runScraper} disabled={runState === "loading"} className="shrink-0 rounded-full bg-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-wait disabled:opacity-60">
          {runState === "loading" ? "Scraping…" : "Run Scraper"}
        </button>
      </div>

      <div className="mt-6 min-h-10" aria-live="polite">
        {runState === "idle" && <p className="text-sm text-ink/45">No scrape run in this session.</p>}
        {runState === "loading" && <p className="text-sm text-teal">Waiting for Bright Data to return the collector result…</p>}
        {runState === "error" && <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>}
        {runState === "success" && response?.success && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-mist p-4"><p className="text-xs text-ink/50">Pages found</p><p className="mt-1 text-2xl font-semibold text-ink">{response.quality.pagesFound}</p></div>
              <div className="rounded-xl bg-mist p-4"><p className="text-xs text-ink/50">Extraction quality</p><p className="mt-1 text-2xl font-semibold capitalize text-ink">{response.quality.qualityStatus}</p></div>
              <div className="rounded-xl bg-mist p-4"><p className="text-xs text-ink/50">Quality score</p><p className="mt-1 text-2xl font-semibold text-ink">{Math.round(response.quality.qualityScore * 100)}%</p></div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Preview</p>
              <div className="mt-2 divide-y divide-ink/10 rounded-xl border border-ink/10">
                {response.snapshot.pages.slice(0, 2).map((page) => (
                  <div key={page.url} className="p-4">
                    <p className="font-semibold text-ink">{page.title || page.url}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-ink/55">{page.description || page.sections[0]?.content || "No preview text extracted."}</p>
                  </div>
                ))}
                {response.snapshot.pages.length === 0 && <p className="p-4 text-sm text-ink/55">No pages were returned.</p>}
              </div>
              <p className="mt-2 text-xs text-ink/45">{response.quality.explanation}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
