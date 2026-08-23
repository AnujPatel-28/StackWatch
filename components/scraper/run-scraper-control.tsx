"use client";

import { useEffect, useState } from "react";
import type { ScrapeApiResponse } from "@/lib/scraper/types";

type RunState = "idle" | "loading" | "success" | "error";
type HealingState = "healing" | "awaiting_approval" | "rerunning" | "recovered" | "failed";
type HealingJobView = { id: string; state: HealingState; error?: string; progress?: { step?: string; completedSteps?: string[] }; currentQualityScore?: number };
type HistoryEntry = { id: string; createdAt: string; qualityScore: number; qualityStatus: string; status: string; changeDetected: boolean };

function formatCoverage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function displayStatus(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function RunScraperControl() {
  const [runState, setRunState] = useState<RunState>("idle");
  const [response, setResponse] = useState<ScrapeApiResponse | null>(null);
  const [error, setError] = useState("");
  const [sourceUrl, setSourceUrl] = useState("https://stackwatch-demo.vercel.app/");
  const [healingJob, setHealingJob] = useState<HealingJobView | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  async function loadHistory(url: string) {
    const result = await fetch(`/api/history?url=${encodeURIComponent(url)}`);
    if (!result.ok) return;
    const body = await result.json() as { entries?: HistoryEntry[] };
    setHistoryEntries(body.entries ?? []);
  }

  useEffect(() => {
    if (!healingJob || healingJob.state !== "healing") return;
    const check = async () => {
      const result = await fetch(`/api/heal?jobId=${encodeURIComponent(healingJob.id)}`);
      if (!result.ok) return;
      const body = await result.json() as { job?: HealingJobView };
      if (body.job) setHealingJob(body.job);
    };
    void check();
    const interval = window.setInterval(() => void check(), 2_500);
    return () => window.clearInterval(interval);
  }, [healingJob]);

  async function runScraper() {
    setRunState("loading");
    setResponse(null);
    setError("");
    try {
      const result = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const body = await result.json() as ScrapeApiResponse;
      if (!result.ok || !body.success) {
        setRunState("error");
        setError(body.success ? "The scrape failed." : body.error);
        return;
      }
      setResponse(body);
      setRunState("success");
      void loadHistory(body.snapshot.sourceUrl);
    } catch {
      setRunState("error");
      setError("Could not reach the StackWatch scrape endpoint.");
    }
  }

  async function startHealing() {
    if (!response?.success) return;
    const result = await fetch("/api/heal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceUrl: response.snapshot.sourceUrl, previousQualityScore: response.quality.qualityScore }),
    });
    const body = await result.json() as { jobId?: string; error?: string };
    if (!result.ok || !body.jobId) { setError(body.error ?? "Could not start Bright Data healing."); return; }
    setHealingJob({ id: body.jobId, state: "healing" });
  }

  async function approveHealing() {
    if (!healingJob) return;
    setHealingJob({ ...healingJob, state: "rerunning" });
    const result = await fetch("/api/heal/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: healingJob.id }) });
    const body = await result.json() as { job?: HealingJobView; error?: string };
    if (body.job) setHealingJob(body.job);
    else setHealingJob({ ...healingJob, state: "failed", error: body.error ?? "Could not approve Bright Data healing." });
    if (result.ok && response?.success) void loadHistory(response.snapshot.sourceUrl);
  }

  return (
    <section className="mt-8 rounded-2xl border border-teal/20 bg-white p-6 shadow-soft sm:p-8" aria-labelledby="scraper-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal">Manual operator action</p>
          <h2 id="scraper-title" className="mt-2 text-2xl font-semibold tracking-tight text-ink">Run the documentation scraper</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink/55">Triggers the configured Bright Data collector, compares against the latest available baseline, and returns a normalized preview.</p>
        </div>
        <button type="button" onClick={runScraper} disabled={runState === "loading"} className="min-h-11 shrink-0 rounded-full bg-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-wait disabled:opacity-60">
          {runState === "loading" ? "Scraping…" : "Run scraper"}
        </button>
      </div>

      <div className="mt-6">
        <label htmlFor="source-url" className="text-sm font-semibold text-ink">Documentation URL</label>
        <input id="source-url" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://docs.example.com/" className="mt-2 block min-h-11 w-full rounded-xl border border-ink/20 bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-teal focus:ring-2 focus:ring-teal/20" />
        <p className="mt-2 text-xs leading-5 text-ink/50">The configured collector is bound to the StackWatch demo fixture. Other documentation sites need their own Bright Data collector.</p>
      </div>

      <div className="mt-6 min-h-10" aria-live="polite">
        {runState === "idle" && <p className="text-sm text-ink/45">No scrape run in this session.</p>}
        {runState === "loading" && <p className="text-sm text-teal">Waiting for Bright Data to return the collector result…</p>}
        {runState === "error" && <p className="rounded-xl bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>}
        {runState === "success" && response?.success && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-ink p-4 text-white"><p className="text-xs text-white/60">Current status</p><p className="mt-1 text-2xl font-semibold">{displayStatus(response.comparison.runStatus)}</p></div>
              <div className="rounded-xl bg-mist p-4"><p className="text-xs text-ink/50">Pages found</p><p className="mt-1 text-2xl font-semibold text-ink">{response.quality.pagesFound}</p></div>
              <div className="rounded-xl bg-mist p-4"><p className="text-xs text-ink/50">Extraction quality</p><p className="mt-1 text-2xl font-semibold capitalize text-ink">{response.quality.qualityStatus}</p></div>
              <div className="rounded-xl bg-mist p-4"><p className="text-xs text-ink/50">Quality score</p><p className="mt-1 text-2xl font-semibold text-ink">{Math.round(response.quality.qualityScore * 100)}%</p></div>
            </div>
            <div className="rounded-xl border border-ink/10 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Quality breakdown</p>
              <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-ink/50">Pages found / unique</dt><dd className="mt-1 font-semibold text-ink">{response.quality.pagesFound} / {response.quality.uniquePages}</dd></div>
                <div><dt className="text-ink/50">Title coverage</dt><dd className="mt-1 font-semibold text-ink">{formatCoverage(response.quality.titleCoverage)}</dd></div>
                <div><dt className="text-ink/50">Meaningful content</dt><dd className="mt-1 font-semibold text-ink">{formatCoverage(response.quality.meaningfulContentCoverage)}</dd></div>
                <div><dt className="text-ink/50">Description coverage</dt><dd className="mt-1 font-semibold text-ink">{formatCoverage(response.quality.descriptionCoverage)}</dd></div>
                <div><dt className="text-ink/50">Structured content count</dt><dd className="mt-1 font-semibold text-ink">{response.quality.structuredContentCount}</dd></div>
                <div><dt className="text-ink/50">Quality score</dt><dd className="mt-1 font-semibold text-ink">{formatCoverage(response.quality.qualityScore)}</dd></div>
                <div><dt className="text-ink/50">Quality status</dt><dd className="mt-1 font-semibold capitalize text-ink">{response.quality.qualityStatus}</dd></div>
              </dl>
              {response.quality.degradationReason && <p className="mt-4 rounded-lg bg-coral/10 px-3 py-2 text-xs text-coral">Degradation reason: {response.quality.degradationReason}</p>}
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-ink/60">Baseline: {response.comparison.hasBaseline ? "available" : "not available"}</span>
              <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-ink/60">Snapshot: {response.comparison.snapshotSaved ? "saved" : "not saved"}</span>
              <span className={`rounded-full border px-3 py-1.5 ${response.comparison.changeDetected ? "border-coral/20 bg-coral/10 text-coral" : "border-teal/20 bg-teal/10 text-teal"}`}>Change: {response.comparison.changeDetected ? "detected" : "not detected"}</span>
              <span className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-ink/60">Alert: {response.notification?.delivered ? "delivered" : response.notification?.reason ?? "not sent"}</span>
            </div>
            {response.comparison.changeReport && (
              <section className="rounded-xl border border-coral/20 bg-coral/5 p-4" aria-labelledby="changes-title">
                <p id="changes-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-coral">Detected changes</p>
                <div className="mt-3 space-y-3">
                  {response.comparison.changeReport.changes.slice(0, 4).map((change) => <div key={`${change.type}-${change.page}-${change.summary}`} className="rounded-lg bg-white p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-ink">{change.page}</p><span className="rounded-full bg-coral/10 px-2 py-1 text-xs font-semibold uppercase text-coral">{change.severity}</span></div><p className="mt-1 text-ink/65">{change.summary}</p></div>)}
                </div>
              </section>
            )}
            {response.comparison.runStatus === "degraded" && !healingJob && <button type="button" onClick={startHealing} className="min-h-11 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">Start Bright Data healing</button>}
            {healingJob && (
              <section className={`rounded-xl border p-4 ${healingJob.state === "failed" ? "border-coral/20 bg-coral/5" : healingJob.state === "recovered" ? "border-teal/20 bg-teal/5" : "border-amber/30 bg-amber/10"}`} aria-live="polite">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">Healing status</p>
                <p className="mt-2 text-lg font-semibold text-ink">{healingJob.state === "healing" ? "Bright Data is repairing the extraction template" : healingJob.state === "awaiting_approval" ? "Repair is ready for approval" : healingJob.state === "rerunning" ? "Re-running the same collector" : healingJob.state === "recovered" ? "Scraper recovered" : "Healing did not complete"}</p>
                <p className="mt-1 text-sm text-ink/60">{healingJob.error ?? healingJob.progress?.step ?? (healingJob.state === "healing" ? "Checking Bright Data progress; this can take a few minutes." : healingJob.state === "awaiting_approval" ? "Review the Bright Data repair, then re-run the collector." : healingJob.state === "recovered" ? `Healthy extraction returned${healingJob.currentQualityScore === undefined ? "." : ` at ${formatCoverage(healingJob.currentQualityScore)}.`}` : "Review the repair details and try again if appropriate.")}</p>
                {healingJob.state === "awaiting_approval" && <button type="button" onClick={approveHealing} className="mt-4 min-h-11 rounded-full bg-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal">Approve and re-run</button>}
              </section>
            )}
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
            <section className="rounded-xl border border-ink/10 bg-white p-4" aria-labelledby="history-title">
              <p id="history-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Recent snapshot history</p>
              {historyEntries.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/45"><tr><th className="pb-2 font-semibold">Timestamp</th><th className="pb-2 font-semibold">Quality</th><th className="pb-2 font-semibold">Status</th><th className="pb-2 font-semibold">Change</th></tr></thead><tbody>{historyEntries.map((entry) => <tr key={entry.id} className="border-b border-ink/5 last:border-0"><td className="py-3 text-ink/60">{new Date(entry.createdAt).toLocaleString()}</td><td className="py-3 font-semibold text-ink">{formatCoverage(entry.qualityScore)}</td><td className="py-3 capitalize text-ink">{displayStatus(entry.status)}</td><td className="py-3 text-ink/60">{entry.changeDetected ? "Detected" : "None"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-ink/55">The saved snapshots for this source will appear here after the run completes.</p>}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
