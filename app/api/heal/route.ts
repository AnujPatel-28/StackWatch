import { NextResponse } from "next/server";
import { createHealingJob, getHealingJob, updateHealingJob } from "@/lib/healing/job-store";
import { BrightDataApiError } from "@/lib/scraper/bright-data-client";
import { createBrightDataHealClientFromEnv } from "@/lib/scraper/bright-data-heal";
import { validateSourceUrl } from "@/lib/scraper/source-url";

export const runtime = "nodejs";

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Bright Data healing failed.";
}

async function runHealingJob(jobId: string): Promise<void> {
  const job = getHealingJob(jobId);
  if (!job) return;
  try {
    const client = createBrightDataHealClientFromEnv();
    const started = await client.start(job.prompt);
    updateHealingJob(jobId, { progress: started });
    const gate = started.status === "pending_answer" ? started : await client.pollUntilGate((progress) => updateHealingJob(jobId, { progress }));
    if (gate.status === "pending_answer") {
      updateHealingJob(jobId, { state: "awaiting_approval", progress: gate });
      return;
    }
    updateHealingJob(jobId, { state: "failed", progress: gate, error: `Bright Data healing ended with status ${gate.status}.` });
  } catch (error) {
    if (error instanceof BrightDataApiError) {
      console.error("Bright Data healing request failed", {
        status: error.statusCode,
        responseBody: error.responseBody,
      });
    }
    updateHealingJob(jobId, { state: "failed", error: messageFor(error) });
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json() as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {}

  const validation = validateSourceUrl(typeof body.sourceUrl === "string" ? body.sourceUrl : "");
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 });
  const prompt = typeof body.prompt === "string" && body.prompt.trim()
    ? body.prompt.trim()
    : "The documentation page structure changed. Repair the extraction template while preserving the existing structured output fields.";
  const previousQualityScore = typeof body.previousQualityScore === "number" ? body.previousQualityScore : undefined;
  const job = createHealingJob({ sourceUrl: validation.url, prompt, previousQualityScore });
  void runHealingJob(job.id);
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
  const job = getHealingJob(jobId);
  if (!job) return NextResponse.json({ error: "Healing job not found." }, { status: 404 });
  return NextResponse.json({ job });
}
