import type { ExtractionQuality, NormalizedDocumentationSnapshot } from "@/lib/scraper/types";

export type SnapshotRecord = {
  id: string;
  sourceUrl: string;
  createdAt: string;
  normalizedSnapshot: NormalizedDocumentationSnapshot;
  quality: ExtractionQuality;
};

export type NewSnapshotRecord = Omit<SnapshotRecord, "id">;
