import { NextResponse } from "next/server";
import { buildRecoveryMessage } from "@/lib/notifications/messages";
import { createTelegramClientFromEnv } from "@/lib/notifications/telegram";
import { getHealingJob, updateHealingJob } from "@/lib/healing/job-store";
import { createBrightDataHealClientFromEnv } from "@/lib/scraper/bright-data-heal";
import { createBrightDataClientFromEnv } from "@/lib/scraper/bright-data";
import { executeScrape } from "@/lib/scraper/run-scrape";
import { createSnapshotRepositoryFromEnv } from "@/lib/snapshots/factory";

export const runtime = "nodejs";

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "The recovery scrape failed.";
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json() as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {}
  const jobId = typeof body.jobId === "string" ? body.jobId : "";
  const job = getHealingJob(jobId);
  if (!job) return NextResponse.json({ error: "Healing job not found." }, { status: 404 });
  if (job.state !== "awaiting_approval") return NextResponse.json({ error: "This healing job is not awaiting approval." }, { status: 409 });

  try {
    const client = createBrightDataHealClientFromEnv();
    const progress = await client.approve(true);
    updateHealingJob(job.id, { state: "rerunning", progress });
    const result = await executeScrape({ sourceUrl: job.sourceUrl, scraper: createBrightDataClientFromEnv(), repository: createSnapshotRepositoryFromEnv() });
    if (result.quality.qualityStatus !== "healthy") {
      const failed = updateHealingJob(job.id, { state: "failed", currentQualityScore: result.quality.qualityScore, error: "The repaired collector did not return a healthy extraction." });
      return NextResponse.json({ job: failed, result });
    }
    const notification = await createTelegramClientFromEnv().sendMessage(buildRecoveryMessage(job.sourceUrl, job.previousQualityScore ?? 0, result.quality.qualityScore));
    const recovered = updateHealingJob(job.id, { state: "recovered", currentQualityScore: result.quality.qualityScore });
    return NextResponse.json({ job: recovered, result, notification });
  } catch (error) {
    const failed = updateHealingJob(job.id, { state: "failed", error: messageFor(error) });
    return NextResponse.json({ job: failed, error: messageFor(error) }, { status: 502 });
  }
}
