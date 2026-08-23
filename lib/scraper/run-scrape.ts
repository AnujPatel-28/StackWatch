import { evaluateExtractionQuality } from "./quality.ts";
import { normalizeBrightDataResult } from "./normalize.ts";
import type { ExtractionQuality, NormalizedDocumentationSnapshot, ScrapeComparisonMetadata, ScrapeRunStatus } from "./types.ts";
import { detectDocumentationChanges } from "../change-detection/detect.ts";
import type { ChangeReport } from "../change-detection/detect.ts";
import { snapshotsHaveChanged } from "../snapshots/compare.ts";
import type { SnapshotRepository } from "../snapshots/repository.ts";
import type { SnapshotRecord } from "../snapshots/types.ts";

export type RawDocumentationScraper = {
  scrape(sourceUrl: string): Promise<unknown>;
};

export type ScrapeExecutionResult = {
  snapshot: NormalizedDocumentationSnapshot;
  quality: ReturnType<typeof evaluateExtractionQuality>;
  comparison: ScrapeComparisonMetadata;
};

type ResolvedBaseline = {
  snapshot: NormalizedDocumentationSnapshot;
  recordId?: string;
};

/** A degraded snapshot is evidence of a broken scraper, so it must never become the baseline a recovery is measured against. */
async function resolveBaseline(
  repository: SnapshotRepository,
  sourceUrl: string,
  previousRecord: SnapshotRecord | null,
  override: NormalizedDocumentationSnapshot | undefined,
): Promise<ResolvedBaseline | null> {
  const healthyRecord = await repository.getLatestHealthySnapshot(sourceUrl);
  if (healthyRecord) return { snapshot: healthyRecord.normalizedSnapshot, recordId: healthyRecord.id };
  if (previousRecord && previousRecord.quality.qualityStatus !== "degraded") {
    return { snapshot: previousRecord.normalizedSnapshot, recordId: previousRecord.id };
  }
  return override ? { snapshot: override } : null;
}

/**
 * Extraction damage and documentation edits look alike in a raw diff, so only a run whose own
 * quality came back healthy is allowed to claim the documentation changed.
 */
function resolveRunStatus(quality: ExtractionQuality, baseline: ResolvedBaseline | null, changeReport: ChangeReport | null): ScrapeRunStatus {
  if (quality.qualityStatus === "failed") return "failed";
  if (!baseline) return "baseline";
  if (quality.qualityStatus === "degraded") return "degraded";
  if (quality.qualityStatus === "partial") return "partial";
  return changeReport?.changeDetected ? "changed" : "unchanged";
}

export async function executeScrape({
  sourceUrl,
  scraper,
  repository,
  previousSnapshotOverride,
}: {
  sourceUrl: string;
  scraper: RawDocumentationScraper;
  repository: SnapshotRepository;
  previousSnapshotOverride?: NormalizedDocumentationSnapshot;
}): Promise<ScrapeExecutionResult> {
  const previousRecord = await repository.getLatestSnapshot(sourceUrl);
  const baseline = await resolveBaseline(repository, sourceUrl, previousRecord, previousSnapshotOverride);
  const rawResult = await scraper.scrape(sourceUrl);
  const snapshot = normalizeBrightDataResult(rawResult, sourceUrl);
  const quality = evaluateExtractionQuality(snapshot, baseline?.snapshot);
  const changeDetected = baseline ? snapshotsHaveChanged(baseline.snapshot, snapshot) : false;
  const changeReport = baseline && quality.qualityStatus === "healthy" ? detectDocumentationChanges(baseline.snapshot, snapshot) : null;
  const runStatus = resolveRunStatus(quality, baseline, changeReport);

  const savedRecord = quality.qualityStatus === "failed" || snapshot.pages.length === 0
    ? null
    : await repository.saveSnapshot({
        sourceUrl: snapshot.sourceUrl,
        createdAt: new Date().toISOString(),
        normalizedSnapshot: snapshot,
        quality,
      });

  return {
    snapshot,
    quality,
    comparison: {
      runStatus,
      changeReport: runStatus === "changed" && changeReport ? changeReport : undefined,
      hasBaseline: Boolean(baseline),
      previousSnapshotId: previousRecord?.id,
      baselineSnapshotId: baseline?.recordId,
      currentSnapshotId: savedRecord?.id,
      snapshotSaved: Boolean(savedRecord),
      changeDetected,
      degradationReason: quality.degradationReason,
    },
  };
}
