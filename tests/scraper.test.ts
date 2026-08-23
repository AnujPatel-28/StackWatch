import assert from "node:assert/strict";
import { test } from "node:test";
import { BrightDataClient } from "../lib/scraper/bright-data-client.ts";
import { normalizeBrightDataResult } from "../lib/scraper/normalize.ts";
import { evaluateExtractionQuality } from "../lib/scraper/quality.ts";
import { executeScrape } from "../lib/scraper/run-scrape.ts";
import { InMemorySnapshotRepository } from "../lib/snapshots/in-memory-repository.ts";

const sourceUrl = "https://stackwatch-demo.vercel.app/authentication";

function healthyRawResult() {
  return [
    {
      url: `${sourceUrl}/`,
      title: "Authentication",
      description: "Authenticate requests with StackWatch.",
      sections: [{ heading: "Overview", content: "Use a bearer token for authenticated requests." }],
      api_endpoints: [{ method: "GET", path: "/authentication", description: "Check authentication." }],
      code_examples: [{ label: "JavaScript", code: "client.authenticate(token)" }],
    },
    {
      url: "https://stackwatch-demo.vercel.app/concepts",
      title: "Concepts",
      description: "Core concepts for using StackWatch.",
      sections: [],
      api_endpoints: [],
      code_examples: [],
    },
    {
      url: "https://stackwatch-demo.vercel.app/errors",
      title: "Errors",
      description: "Understand common StackWatch errors.",
      sections: [{ heading: "Common errors", content: "Handle invalid credentials carefully." }],
      api_endpoints: [],
      code_examples: [{ label: "curl", code: "curl /errors" }],
    },
  ];
}

test("normalizes a structured Bright Data result", () => {
  const snapshot = normalizeBrightDataResult(healthyRawResult(), sourceUrl, "2026-08-23T00:00:00.000Z");
  assert.equal(snapshot.pages.length, 3);
  assert.deepEqual(snapshot.pages[0].apiEndpoints, [{ method: "GET", path: "/authentication", description: "Check authentication." }]);
  assert.deepEqual(snapshot.pages[0].codeExamples, [{ label: "JavaScript", code: "client.authenticate(token)" }]);
});

test("canonicalizes and deduplicates equivalent page URLs", () => {
  const snapshot = normalizeBrightDataResult([
    { url: "https://docs.example.test/authentication/#overview", title: "Authentication", sections: [{ content: "Overview" }] },
    { url: "https://docs.example.test/authentication/", description: "Authenticate requests." },
  ], "https://docs.example.test");
  assert.equal(snapshot.pages.length, 1);
  assert.equal(snapshot.pages[0].url, "https://docs.example.test/authentication");
  assert.equal(snapshot.pages[0].description, "Authenticate requests.");
  assert.equal(snapshot.pages[0].sections.length, 1);
});

test("title and description can make a page meaningful without sections", () => {
  const snapshot = normalizeBrightDataResult([{ url: sourceUrl, title: "Authentication", description: "Authenticate requests." }], sourceUrl);
  const quality = evaluateExtractionQuality(snapshot);
  assert.equal(quality.pagesWithSections, 0);
  assert.equal(quality.pagesWithMeaningfulContent, 1);
  assert.equal(quality.qualityStatus, "healthy");
});

test("empty headings, endpoints, and code examples do not count", () => {
  const snapshot = normalizeBrightDataResult([{
    url: sourceUrl,
    title: "Authentication",
    description: "Authenticate requests.",
    sections: [{ heading: "Heading only", content: "" }, { heading: "", content: "   " }],
    api_endpoints: [{}, { method: "", path: "", description: "" }],
    code_examples: [{}, { label: "curl", code: "" }],
  }], sourceUrl);
  const quality = evaluateExtractionQuality(snapshot);
  assert.equal(snapshot.pages[0].sections.length, 0);
  assert.equal(snapshot.pages[0].apiEndpoints.length, 0);
  assert.equal(snapshot.pages[0].codeExamples.length, 0);
  assert.equal(quality.structuredContentCount, 0);
  assert.equal(quality.qualityStatus, "healthy");
});

test("healthy controlled documentation produces healthy", () => {
  const snapshot = normalizeBrightDataResult(healthyRawResult(), sourceUrl);
  const quality = evaluateExtractionQuality(snapshot);
  assert.equal(quality.qualityStatus, "healthy");
  assert.equal(quality.pagesFound, 3);
  assert.equal(quality.uniquePages, 3);
  assert.equal(quality.titleCoverage, 1);
  assert.equal(quality.meaningfulContentCoverage, 1);
});

test("broken documentation compared with a healthy baseline produces degraded", () => {
  const healthySnapshot = normalizeBrightDataResult(healthyRawResult(), sourceUrl);
  const brokenSnapshot = normalizeBrightDataResult(healthyRawResult().map((page) => ({
    ...page,
    sections: [],
    api_endpoints: [],
    code_examples: [],
  })), sourceUrl);
  const quality = evaluateExtractionQuality(brokenSnapshot, healthySnapshot);
  assert.equal(quality.qualityStatus, "degraded");
  assert.match(quality.degradationReason ?? "", /structured content collapsed/i);
});

test("recovered documentation compared with the same healthy baseline produces healthy", () => {
  const healthySnapshot = normalizeBrightDataResult(healthyRawResult(), sourceUrl);
  const recoveredSnapshot = normalizeBrightDataResult(healthyRawResult(), sourceUrl);
  const quality = evaluateExtractionQuality(recoveredSnapshot, healthySnapshot);
  assert.equal(quality.qualityStatus, "healthy");
});

test("no previous snapshot still uses absolute quality", () => {
  const snapshot = normalizeBrightDataResult(healthyRawResult(), sourceUrl);
  assert.equal(evaluateExtractionQuality(snapshot).qualityStatus, "healthy");
});

test("malformed Bright Data output fails without creating fake pages", () => {
  const snapshot = normalizeBrightDataResult({ unexpected: { value: true } }, sourceUrl);
  const quality = evaluateExtractionQuality(snapshot);
  assert.deepEqual(snapshot.pages, []);
  assert.equal(quality.qualityStatus, "failed");
});

test("Bright Data client triggers and polls without making a real network call", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    new Response(JSON.stringify({ response_id: "response-123" }), { status: 200 }),
    new Response("Request is pending", { status: 202 }),
    new Response(JSON.stringify([{ title: "Docs" }]), { status: 200 }),
  ];
  const client = new BrightDataClient({
    apiKey: "test-key",
    collectorId: "c_test",
    pollIntervalMs: 0,
    timeoutMs: 1000,
    sleep: async () => undefined,
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), init });
      return responses.shift() as Response;
    },
  });

  const result = await client.scrape(sourceUrl);
  assert.deepEqual(result, [{ title: "Docs" }]);
  assert.equal(requests.length, 3);
  assert.match(requests[0].url, /trigger_immediate\?collector=c_test$/);
  assert.equal(requests[0].init?.headers && (requests[0].init.headers as Record<string, string>).Authorization, "Bearer test-key");
  assert.equal(requests[0].init?.body, JSON.stringify({ url: sourceUrl }));
  assert.match(requests[1].url, /get_result\?response_id=response-123$/);
});

test("snapshot repository saves and retrieves the latest record by source URL", async () => {
  const repository = new InMemorySnapshotRepository();
  const snapshot = normalizeBrightDataResult(healthyRawResult(), sourceUrl);
  const quality = evaluateExtractionQuality(snapshot);
  assert.equal(await repository.getLatestSnapshot(sourceUrl), null);

  const first = await repository.saveSnapshot({ sourceUrl, createdAt: "2026-08-23T00:00:00.000Z", normalizedSnapshot: snapshot, quality });
  const second = await repository.saveSnapshot({ sourceUrl, createdAt: "2026-08-23T00:01:00.000Z", normalizedSnapshot: snapshot, quality });
  assert.ok(first.id);
  assert.notEqual(first.id, second.id);
  assert.equal((await repository.getLatestSnapshot(sourceUrl))?.id, second.id);
});

test("snapshot repository is isolated from scraper implementation", async () => {
  const repository = new InMemorySnapshotRepository();
  const normalizedSnapshot = { sourceUrl, capturedAt: "2026-08-23T00:00:00.000Z", pages: [] };
  const quality = evaluateExtractionQuality(normalizedSnapshot);
  const saved = await repository.saveSnapshot({ sourceUrl, createdAt: "2026-08-23T00:00:00.000Z", normalizedSnapshot, quality });
  assert.equal(saved.normalizedSnapshot, normalizedSnapshot);
  assert.equal((await repository.getLatestSnapshot(sourceUrl))?.quality, quality);
});

test("first scrape has no baseline and saves a successful snapshot", async () => {
  const repository = new InMemorySnapshotRepository();
  const result = await executeScrape({
    sourceUrl,
    scraper: { scrape: async () => healthyRawResult() },
    repository,
  });
  assert.equal(result.comparison.hasBaseline, false);
  assert.equal(result.comparison.snapshotSaved, true);
  assert.ok(result.comparison.currentSnapshotId);
  assert.equal(result.quality.qualityStatus, "healthy");
});

test("second scrape retrieves the previous snapshot before comparing and saving", async () => {
  const repository = new InMemorySnapshotRepository();
  let run = 0;
  const resultOne = await executeScrape({
    sourceUrl,
    scraper: { scrape: async () => healthyRawResult() },
    repository,
  });
  run += 1;
  const resultTwo = await executeScrape({
    sourceUrl,
    scraper: {
      scrape: async () => healthyRawResult().map((page) => run === 1 ? { ...page, description: `${page.description} Updated.` } : page),
    },
    repository,
  });
  assert.equal(resultTwo.comparison.hasBaseline, true);
  assert.equal(resultTwo.comparison.previousSnapshotId, resultOne.comparison.currentSnapshotId);
  assert.notEqual(resultTwo.comparison.currentSnapshotId, resultOne.comparison.currentSnapshotId);
  assert.equal(resultTwo.comparison.changeDetected, true);
});

test("degraded scrape is classified against the persisted healthy baseline", async () => {
  const repository = new InMemorySnapshotRepository();
  await executeScrape({ sourceUrl, scraper: { scrape: async () => healthyRawResult() }, repository });
  const result = await executeScrape({
    sourceUrl,
    scraper: { scrape: async () => healthyRawResult().map((page) => ({ ...page, sections: [], api_endpoints: [], code_examples: [] })) },
    repository,
  });
  assert.equal(result.quality.qualityStatus, "degraded");
  assert.equal(result.comparison.hasBaseline, true);
  assert.equal(result.comparison.changeDetected, true);
  assert.match(result.comparison.degradationReason ?? "", /structured content collapsed/i);
});

test("recovered scrape returns healthy when compared with the same healthy baseline", async () => {
  const repository = new InMemorySnapshotRepository();
  await executeScrape({ sourceUrl, scraper: { scrape: async () => healthyRawResult() }, repository });
  const result = await executeScrape({ sourceUrl, scraper: { scrape: async () => healthyRawResult() }, repository });
  assert.equal(result.quality.qualityStatus, "healthy");
  assert.equal(result.comparison.hasBaseline, true);
  assert.equal(result.comparison.changeDetected, false);
});

test("failed or malformed scrapes do not overwrite the previous successful baseline", async () => {
  const repository = new InMemorySnapshotRepository();
  const first = await executeScrape({ sourceUrl, scraper: { scrape: async () => healthyRawResult() }, repository });
  await assert.rejects(() => executeScrape({ sourceUrl, scraper: { scrape: async () => { throw new Error("scraper unavailable"); } }, repository }));
  assert.equal((await repository.getLatestSnapshot(sourceUrl))?.id, first.comparison.currentSnapshotId);

  const malformed = await executeScrape({ sourceUrl, scraper: { scrape: async () => ({ unexpected: { value: true } }) }, repository });
  assert.equal(malformed.quality.qualityStatus, "failed");
  assert.equal(malformed.comparison.snapshotSaved, false);
  assert.equal((await repository.getLatestSnapshot(sourceUrl))?.id, first.comparison.currentSnapshotId);
});
