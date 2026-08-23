import type { NormalizedDocumentationPage, NormalizedDocumentationSnapshot } from "@/lib/scraper/types";

function comparablePage(page: NormalizedDocumentationPage) {
  return {
    url: page.url,
    title: page.title,
    product: page.product,
    apiVersion: page.apiVersion,
    description: page.description,
    sections: [...page.sections].sort((a, b) => `${a.heading}|${a.content}`.localeCompare(`${b.heading}|${b.content}`)),
    apiEndpoints: [...page.apiEndpoints].sort((a, b) => `${a.method}|${a.path}|${a.description}`.localeCompare(`${b.method}|${b.path}|${b.description}`)),
    codeExamples: [...page.codeExamples].sort((a, b) => `${a.label}|${a.code}`.localeCompare(`${b.label}|${b.code}`)),
  };
}

function comparableSnapshot(snapshot: NormalizedDocumentationSnapshot): string {
  return JSON.stringify({
    sourceUrl: snapshot.sourceUrl,
    pages: snapshot.pages.map(comparablePage).sort((a, b) => a.url.localeCompare(b.url)),
  });
}

export function snapshotsHaveChanged(previous: NormalizedDocumentationSnapshot, current: NormalizedDocumentationSnapshot): boolean {
  return comparableSnapshot(previous) !== comparableSnapshot(current);
}
