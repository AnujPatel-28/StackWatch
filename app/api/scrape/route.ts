import { NextResponse } from "next/server";
import { createBrightDataClientFromEnv, BrightDataApiError } from "@/lib/scraper/bright-data";
import { executeScrape } from "@/lib/scraper/run-scrape";
import { createSnapshotRepositoryFromEnv } from "@/lib/snapshots/factory";
import { validateSourceUrl } from "@/lib/scraper/source-url";
import { buildChangeMessage, buildDegradationMessage } from "@/lib/notifications/messages";
import { createTelegramClientFromEnv } from "@/lib/notifications/telegram";
import type { NormalizedDocumentationSnapshot, ScrapeApiResponse } from "@/lib/scraper/types";

export const runtime = "nodejs";

function isNormalizedSnapshot(value: unknown): value is NormalizedDocumentationSnapshot {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.sourceUrl !== "string" || typeof record.capturedAt !== "string" || !Array.isArray(record.pages)) return false;
  return record.pages.every((page) => {
    if (page === null || typeof page !== "object" || Array.isArray(page)) return false;
    const pageRecord = page as Record<string, unknown>;
    return typeof pageRecord.url === "string" &&
      typeof pageRecord.title === "string" &&
      typeof pageRecord.description === "string" &&
      Array.isArray(pageRecord.sections) &&
      Array.isArray(pageRecord.apiEndpoints) &&
      Array.isArray(pageRecord.codeExamples);
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json() as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    // An empty POST is valid and uses the configured documentation URL.
  }

  const requestedUrl = typeof body.url === "string" ? body.url.trim() : "";
  const sourceUrl = requestedUrl || process.env.BRIGHTDATA_DOCS_URL;
  if (!sourceUrl) {
    return NextResponse.json<ScrapeApiResponse>({ success: false, error: "BRIGHTDATA_DOCS_URL is not configured." }, { status: 500 });
  }
  const validatedSourceUrl = validateSourceUrl(sourceUrl);
  if (!validatedSourceUrl.ok) {
    return NextResponse.json<ScrapeApiResponse>({ success: false, error: validatedSourceUrl.reason }, { status: 400 });
  }
  const previousSnapshot = body.previousSnapshot === undefined || body.previousSnapshot === null
    ? undefined
    : isNormalizedSnapshot(body.previousSnapshot) ? body.previousSnapshot : null;
  if (previousSnapshot === null) {
    return NextResponse.json<ScrapeApiResponse>({ success: false, error: "previousSnapshot must be a normalized documentation snapshot." }, { status: 400 });
  }

  try {
    const result = await executeScrape({
      sourceUrl: validatedSourceUrl.url,
      scraper: createBrightDataClientFromEnv(),
      repository: createSnapshotRepositoryFromEnv(),
      previousSnapshotOverride: previousSnapshot ?? undefined,
    });
    const telegram = createTelegramClientFromEnv();
    const notification = result.comparison.runStatus === "changed" && result.comparison.changeReport
      ? await telegram.sendMessage(buildChangeMessage(result.snapshot.sourceUrl, result.comparison.changeReport))
      : result.comparison.runStatus === "degraded"
        ? await telegram.sendMessage(buildDegradationMessage(result.snapshot.sourceUrl, result.quality.degradationReason ?? "Extraction quality regressed.", result.quality.qualityScore))
        : undefined;
    return NextResponse.json<ScrapeApiResponse>({ success: true, ...result, notification });
  } catch (error) {
    const message = error instanceof BrightDataApiError || error instanceof Error ? error.message : "The documentation scrape failed.";
    return NextResponse.json<ScrapeApiResponse>({ success: false, error: message }, { status: 502 });
  }
}
