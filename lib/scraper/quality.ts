import type { ExtractionQuality, NormalizedDocumentationSnapshot } from "./types";

function roundScore(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
}

function summarize(snapshot: NormalizedDocumentationSnapshot): Omit<ExtractionQuality, "qualityScore" | "qualityStatus" | "explanation"> {
  return {
    pagesFound: snapshot.pages.length,
    pagesWithTitles: snapshot.pages.filter((page) => Boolean(page.title)).length,
    pagesWithSections: snapshot.pages.filter((page) => page.sections.length > 0).length,
    totalSections: snapshot.pages.reduce((total, page) => total + page.sections.length, 0),
    totalApiEndpoints: snapshot.pages.reduce((total, page) => total + page.apiEndpoints.length, 0),
    totalCodeExamples: snapshot.pages.reduce((total, page) => total + page.codeExamples.length, 0),
  };
}

function previousSummary(previous: NormalizedDocumentationSnapshot | ExtractionQuality | undefined) {
  if (!previous) return undefined;
  return "pages" in previous ? summarize(previous) : previous;
}

export function evaluateExtractionQuality(
  snapshot: NormalizedDocumentationSnapshot,
  previous?: NormalizedDocumentationSnapshot | ExtractionQuality,
): ExtractionQuality {
  const counts = summarize(snapshot);
  if (counts.pagesFound === 0) {
    return { ...counts, qualityScore: 0, qualityStatus: "failed", explanation: "No documentation pages were returned." };
  }

  const titleCoverage = counts.pagesWithTitles / counts.pagesFound;
  const sectionCoverage = counts.pagesWithSections / counts.pagesFound;
  const structuredItems = counts.totalSections + counts.totalApiEndpoints + counts.totalCodeExamples;
  const structuredSignal = Math.min(1, structuredItems / Math.max(1, counts.pagesFound * 3));
  const descriptionCoverage = snapshot.pages.filter((page) => Boolean(page.description)).length / counts.pagesFound;
  const qualityScore = roundScore(
    titleCoverage * 0.25 +
    sectionCoverage * 0.4 +
    structuredSignal * 0.15 +
    descriptionCoverage * 0.2,
  );

  const baseline = previousSummary(previous);
  const baselineStructuredItems = baseline
    ? baseline.totalSections + baseline.totalApiEndpoints + baseline.totalCodeExamples
    : 0;
  const sectionCollapse = Boolean(
    baseline &&
    baseline.totalSections > 0 &&
    counts.totalSections === 0 &&
    counts.pagesWithSections < baseline.pagesWithSections,
  );
  const structuredCollapse = Boolean(
    baseline &&
    baselineStructuredItems >= 4 &&
    structuredItems <= baselineStructuredItems * 0.25,
  );

  if (sectionCollapse || structuredCollapse) {
    return {
      ...counts,
      qualityScore,
      qualityStatus: "degraded",
      explanation: "Pages were returned, but structured documentation content collapsed compared with the previous result.",
    };
  }

  const hasMeaningfulContent = counts.totalSections > 0 || counts.totalApiEndpoints > 0 || counts.totalCodeExamples > 0;
  if (counts.pagesWithTitles === counts.pagesFound && hasMeaningfulContent && qualityScore >= 0.7) {
    return { ...counts, qualityScore, qualityStatus: "healthy", explanation: "Pages have titles and meaningful structured documentation content." };
  }

  if (counts.pagesWithTitles > 0 || hasMeaningfulContent || descriptionCoverage > 0) {
    return { ...counts, qualityScore, qualityStatus: "partial", explanation: "Some documentation content was extracted, but coverage is incomplete." };
  }

  return { ...counts, qualityScore, qualityStatus: "degraded", explanation: "Pages were returned without titles or meaningful documentation content." };
}
