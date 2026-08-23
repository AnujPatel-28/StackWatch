import type { ExtractionQuality, NormalizedDocumentationSnapshot } from "./types";

export const QUALITY_WEIGHTS = {
  titleCoverage: 0.25,
  meaningfulContentCoverage: 0.45,
  descriptionCoverage: 0.15,
  structuredContentCoverage: 0.15,
} as const;

export const HEALTHY_SCORE_THRESHOLD = 0.75;
export const HEALTHY_TITLE_COVERAGE_THRESHOLD = 0.875;
export const HEALTHY_MEANINGFUL_CONTENT_THRESHOLD = 0.75;

function round(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

function summarize(snapshot: NormalizedDocumentationSnapshot): Omit<ExtractionQuality, "qualityScore" | "qualityStatus" | "explanation" | "degradationReason"> {
  const pagesWithTitles = snapshot.pages.filter((page) => Boolean(page.title)).length;
  const pagesWithSections = snapshot.pages.filter((page) => page.sections.length > 0).length;
  const pagesWithDescriptions = snapshot.pages.filter((page) => Boolean(page.description)).length;
  const pagesWithMeaningfulContent = snapshot.pages.filter((page) => Boolean(
    page.description || page.sections.length || page.apiEndpoints.length || page.codeExamples.length,
  )).length;
  const totalSections = snapshot.pages.reduce((total, page) => total + page.sections.length, 0);
  const totalApiEndpoints = snapshot.pages.reduce((total, page) => total + page.apiEndpoints.length, 0);
  const totalCodeExamples = snapshot.pages.reduce((total, page) => total + page.codeExamples.length, 0);
  const structuredContentCount = totalSections + totalApiEndpoints + totalCodeExamples;
  const pagesFound = snapshot.pages.length;
  return {
    pagesFound,
    uniquePages: pagesFound,
    pagesWithTitles,
    pagesWithSections,
    pagesWithMeaningfulContent,
    pagesWithDescriptions,
    totalSections,
    totalApiEndpoints,
    totalCodeExamples,
    structuredContentCount,
    titleCoverage: pagesFound ? round(pagesWithTitles / pagesFound) : 0,
    meaningfulContentCoverage: pagesFound ? round(pagesWithMeaningfulContent / pagesFound) : 0,
    descriptionCoverage: pagesFound ? round(pagesWithDescriptions / pagesFound) : 0,
    structuredContentCoverage: pagesFound ? round(snapshot.pages.filter((page) => Boolean(page.sections.length || page.apiEndpoints.length || page.codeExamples.length)).length / pagesFound) : 0,
  };
}

function previousSummary(previous: NormalizedDocumentationSnapshot | ExtractionQuality | undefined) {
  if (!previous) return undefined;
  return "pages" in previous ? summarize(previous) : previous;
}

function findDegradationReason(current: ReturnType<typeof summarize>, previous: ReturnType<typeof summarize> | undefined): string | undefined {
  if (!previous) return undefined;
  const reasons: string[] = [];
  const meaningfulCollapse = previous.pagesWithMeaningfulContent >= 4 && current.pagesWithMeaningfulContent < previous.pagesWithMeaningfulContent * 0.5;
  const structuredCollapse = previous.structuredContentCount >= 2 && current.structuredContentCount <= previous.structuredContentCount * 0.25;
  const majorPageLoss = previous.pagesFound >= 4 && current.pagesFound < previous.pagesFound * 0.75;
  if (meaningfulCollapse) reasons.push("meaningful content coverage collapsed");
  if (structuredCollapse) reasons.push("structured content collapsed");
  if (majorPageLoss) reasons.push("a major number of pages was lost");
  return reasons.length ? reasons.join("; ") : undefined;
}

export function evaluateExtractionQuality(
  snapshot: NormalizedDocumentationSnapshot,
  previous?: NormalizedDocumentationSnapshot | ExtractionQuality,
): ExtractionQuality {
  const counts = summarize(snapshot);
  if (counts.pagesFound === 0) {
    return { ...counts, qualityScore: 0, qualityStatus: "failed", explanation: "No documentation pages were returned." };
  }

  const qualityScore = round(
    counts.titleCoverage * QUALITY_WEIGHTS.titleCoverage +
    counts.meaningfulContentCoverage * QUALITY_WEIGHTS.meaningfulContentCoverage +
    counts.descriptionCoverage * QUALITY_WEIGHTS.descriptionCoverage +
    counts.structuredContentCoverage * QUALITY_WEIGHTS.structuredContentCoverage,
  );
  const degradationReason = findDegradationReason(counts, previousSummary(previous));
  if (degradationReason) {
    return {
      ...counts,
      qualityScore,
      qualityStatus: "degraded",
      degradationReason,
      explanation: `Extraction regressed compared with the previous snapshot: ${degradationReason}.`,
    };
  }

  const isHealthy = counts.titleCoverage >= HEALTHY_TITLE_COVERAGE_THRESHOLD &&
    counts.meaningfulContentCoverage >= HEALTHY_MEANINGFUL_CONTENT_THRESHOLD &&
    qualityScore >= HEALTHY_SCORE_THRESHOLD;
  if (isHealthy) {
    return { ...counts, qualityScore, qualityStatus: "healthy", explanation: "Pages have strong title and meaningful-content coverage." };
  }

  if (counts.pagesWithMeaningfulContent > 0 || counts.pagesWithTitles > 0 || counts.pagesWithDescriptions > 0) {
    return { ...counts, qualityScore, qualityStatus: "partial", explanation: "Some documentation content was extracted, but coverage is incomplete." };
  }

  return { ...counts, qualityScore, qualityStatus: "failed", explanation: "Pages were returned without usable documentation content." };
}
