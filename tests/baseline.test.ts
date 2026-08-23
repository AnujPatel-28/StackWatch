import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeBrightDataResult } from "../lib/scraper/normalize.ts";
import { evaluateExtractionQuality } from "../lib/scraper/quality.ts";
import { executeScrape } from "../lib/scraper/run-scrape.ts";
import { InMemorySnapshotRepository } from "../lib/snapshots/in-memory-repository.ts";
import { snapshotsHaveChanged } from "../lib/snapshots/compare.ts";

const sourceUrl = "https://stackwatch-demo.vercel.app/";

function healthyRawResult() {
  return [
    {
      url: sourceUrl,
      title: "Overview",
      description: "StackWatch demo documentation.",
      sections: [{ heading: "Overview", content: "Everything starts here." }],
      api_endpoints: [{ method: "GET", path: "/", description: "Documentation index." }],
      code_examples: [{ label: "curl", code: "curl https://stackwatch-demo.vercel.app/" }],
    },
    {
      url: "https://stackwatch-demo.vercel.app/api/projects",
      title: "Projects API",
      description: "Create and manage projects.",
      sections: [{ heading: "Create", content: "Send a framework field." }],
      api_endpoints: [{ method: "POST", path: "/api/projects", description: "Create a project with a framework field." }],
      code_examples: [{ label: "JavaScript", code: "client.projects.create({ framework: 'next' })" }],
    },
    {
      url: "https://stackwatch-demo.vercel.app/authentication",
      title: "Authentication",
      description: "Authenticate every API request.",
      sections: [{ heading: "Bearer tokens", content: "Send an Authorization header." }],
      api_endpoints: [],
      code_examples: [],
    },
    {
      url: "https://stackwatch-demo.vercel.app/webhooks",
      title: "Webhooks",
      description: "Receive project events.",
      sections: [{ heading: "Delivery", content: "Webhooks retry three times." }],
      api_endpoints: [],
      code_examples: [],
    },
  ];
}

function strippedRawResult() {
  return healthyRawResult().map((page) => ({ ...page, sections: [], api_endpoints: [], code_examples: [] }));
}

test("a degraded run never becomes the baseline for the run that follows it", async () => {
  const repository = new InMemorySnapshotRepository();
  const healthy = await executeScrape({ sourceUrl, scraper: { scrape: async () => healthyRawResult() }, repository });
  const degraded = await executeScrape({ sourceUrl, scraper: { scrape: async () => strippedRawResult() }, repository });
  assert.equal(degraded.quality.qualityStatus, "degraded");

  const recovered = await executeScrape({ sourceUrl, scraper: { scrape: async () => healthyRawResult() }, repository });
  assert.equal(recovered.comparison.baselineSnapshotId, healthy.comparison.currentSnapshotId);
  assert.equal(recovered.quality.qualityStatus, "healthy");
  assert.equal(recovered.comparison.changeDetected, false);
});

test("the previous snapshot id still tracks the run immediately before, not the baseline", async () => {
  const repository = new InMemorySnapshotRepository();
  await executeScrape({ sourceUrl, scraper: { scrape: async () => healthyRawResult() }, repository });
  const degraded = await executeScrape({ sourceUrl, scraper: { scrape: async () => strippedRawResult() }, repository });
  const recovered = await executeScrape({ sourceUrl, scraper: { scrape: async () => healthyRawResult() }, repository });

  assert.equal(recovered.comparison.previousSnapshotId, degraded.comparison.currentSnapshotId);
  assert.notEqual(recovered.comparison.previousSnapshotId, recovered.comparison.baselineSnapshotId);
});

test("getLatestHealthySnapshot skips degraded history", async () => {
  const repository = new InMemorySnapshotRepository();
  const snapshot = normalizeBrightDataResult(healthyRawResult(), sourceUrl);
  const degradedSnapshot = normalizeBrightDataResult(strippedRawResult(), sourceUrl);
  const healthy = await repository.saveSnapshot({
    sourceUrl, createdAt: "2026-08-23T00:00:00.000Z", normalizedSnapshot: snapshot,
    quality: evaluateExtractionQuality(snapshot),
  });
  await repository.saveSnapshot({
    sourceUrl, createdAt: "2026-08-23T00:01:00.000Z", normalizedSnapshot: degradedSnapshot,
    quality: evaluateExtractionQuality(degradedSnapshot, snapshot),
  });

  assert.equal((await repository.getLatestHealthySnapshot(sourceUrl))?.id, healthy.id);
  assert.notEqual((await repository.getLatestSnapshot(sourceUrl))?.id, healthy.id);
});

test("a source with no healthy history still gets a provisional baseline", async () => {
  const repository = new InMemorySnapshotRepository();
  const thin = [{ url: sourceUrl, title: "Overview" }];
  const first = await executeScrape({ sourceUrl, scraper: { scrape: async () => thin }, repository });
  assert.equal(first.comparison.hasBaseline, false);

  const second = await executeScrape({ sourceUrl, scraper: { scrape: async () => thin }, repository });
  assert.equal(second.comparison.hasBaseline, true);
  assert.equal(second.comparison.baselineSnapshotId, first.comparison.currentSnapshotId);
});

test("a snapshot round-tripped through JSONB key reordering compares equal", () => {
  const snapshot = normalizeBrightDataResult(healthyRawResult(), sourceUrl);
  const reordered = {
    ...snapshot,
    pages: snapshot.pages.map((page) => Object.fromEntries(
      Object.entries(page).sort(([left], [right]) => left.length - right.length || left.localeCompare(right)),
    )),
  } as typeof snapshot;

  assert.notEqual(Object.keys(reordered.pages[0]).join(), Object.keys(snapshot.pages[0]).join());
  assert.equal(snapshotsHaveChanged(reordered, snapshot), false);
});
