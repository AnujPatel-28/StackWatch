import { NextResponse } from "next/server";
import { snapshotsHaveChanged } from "@/lib/snapshots/compare";
import { createSnapshotRepositoryFromEnv } from "@/lib/snapshots/factory";
import { validateSourceUrl } from "@/lib/scraper/source-url";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const validation = validateSourceUrl(url.searchParams.get("url") ?? "");
  if (!validation.ok) return NextResponse.json({ error: validation.reason }, { status: 400 });
  const limitValue = Number(url.searchParams.get("limit") ?? "10");
  const limit = Number.isInteger(limitValue) ? Math.max(1, Math.min(limitValue, 25)) : 10;
  const records = await createSnapshotRepositoryFromEnv().listSnapshots(validation.url, limit);
  const entries = records.map((record, index) => {
    const previousHealthy = records.slice(index + 1).find((candidate) => candidate.quality.qualityStatus === "healthy");
    const changeDetected = record.quality.qualityStatus === "healthy" && previousHealthy
      ? snapshotsHaveChanged(previousHealthy.normalizedSnapshot, record.normalizedSnapshot)
      : false;
    return {
      id: record.id,
      createdAt: record.createdAt,
      qualityScore: record.quality.qualityScore,
      qualityStatus: record.quality.qualityStatus,
      status: record.quality.qualityStatus === "healthy" ? changeDetected ? "changed" : "healthy" : record.quality.qualityStatus,
      changeDetected,
    };
  });
  return NextResponse.json({ sourceUrl: validation.url, entries });
}
