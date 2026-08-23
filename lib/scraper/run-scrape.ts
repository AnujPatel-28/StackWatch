import { evaluateExtractionQuality } from "./quality.ts";
import { normalizeBrightDataResult } from "./normalize.ts";
import type { NormalizedDocumentationSnapshot, ScrapeComparisonMetadata } from "./types.ts";
import { snapshotsHaveChanged } from "../snapshots/compare.ts";
import type { SnapshotRepository } from "../snapshots/repository.ts";

export type RawDocumentationScraper = {
  scrape(sourceUrl: string): Promise<unknown>;
};

export type ScrapeExecutionResult = {
  snapshot: NormalizedDocumentationSnapshot;
  quality: ReturnType<typeof evaluateExtractionQuality>;
  comparison: ScrapeComparisonMetadata;
};

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
  const previousSnapshot = previousRecord?.normalizedSnapshot ?? previousSnapshotOverride;
  const rawResult = await scraper.scrape(sourceUrl);
  const snapshot = normalizeBrightDataResult(rawResult, sourceUrl);
  const quality = evaluateExtractionQuality(snapshot, previousSnapshot);
  const changeDetected = previousSnapshot ? snapshotsHaveChanged(previousSnapshot, snapshot) : false;

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
      hasBaseline: Boolean(previousRecord || previousSnapshotOverride),
      previousSnapshotId: previousRecord?.id,
      currentSnapshotId: savedRecord?.id,
      snapshotSaved: Boolean(savedRecord),
      changeDetected,
      degradationReason: quality.degradationReason,
    },
  };
}
