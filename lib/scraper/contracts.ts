import type { DocumentationSource, DocumentationSnapshot, ExtractionHealth } from "@/lib/types";

export type ScrapeRequest = { source: DocumentationSource };

export type ScrapeResult = {
  snapshot: DocumentationSnapshot;
  extractionHealth: ExtractionHealth;
};

/** Provider-agnostic boundary for a future scraper implementation. */
export interface DocumentationScraper {
  scrape(request: ScrapeRequest): Promise<ScrapeResult>;
}
