import type { NormalizedDocumentationSnapshot } from "@/lib/scraper/types";

function comparableSnapshot(snapshot: NormalizedDocumentationSnapshot): string {
  return JSON.stringify({
    sourceUrl: snapshot.sourceUrl,
    pages: [...snapshot.pages].sort((a, b) => a.url.localeCompare(b.url)),
  });
}

export function snapshotsHaveChanged(previous: NormalizedDocumentationSnapshot, current: NormalizedDocumentationSnapshot): boolean {
  return comparableSnapshot(previous) !== comparableSnapshot(current);
}
