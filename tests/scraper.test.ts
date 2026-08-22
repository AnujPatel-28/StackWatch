import assert from "node:assert/strict";
import { test } from "node:test";
import { BrightDataClient } from "../lib/scraper/bright-data-client.ts";
import { normalizeBrightDataResult } from "../lib/scraper/normalize.ts";
import { evaluateExtractionQuality } from "../lib/scraper/quality.ts";

test("normalizes a structured Bright Data result into the StackWatch schema", () => {
  const snapshot = normalizeBrightDataResult([
    {
      url: "https://docs.example.test/authentication",
      title: "Authentication",
      product: "Example SDK",
      api_version: "v2",
      description: "Authenticate API requests.",
      sections: [{ heading: "Overview", content: "Use a bearer token." }],
      api_endpoints: [{ method: "get", path: "/v2/me", description: "Returns the current user." }],
      code_examples: [{ label: "JavaScript", code: "client.me()" }],
    },
  ], "https://docs.example.test/authentication", "2026-08-23T00:00:00.000Z");

  assert.equal(snapshot.pages.length, 1);
  assert.deepEqual(snapshot.pages[0], {
    url: "https://docs.example.test/authentication",
    title: "Authentication",
    product: "Example SDK",
    apiVersion: "v2",
    description: "Authenticate API requests.",
    sections: [{ heading: "Overview", content: "Use a bearer token." }],
    apiEndpoints: [{ method: "GET", path: "/v2/me", description: "Returns the current user." }],
    codeExamples: [{ label: "JavaScript", code: "client.me()" }],
  });
});

test("marks a complete structured extraction healthy", () => {
  const snapshot = normalizeBrightDataResult([{ title: "Docs", description: "Overview", sections: [{ heading: "Start", content: "Read this." }] }], "https://docs.example.test");
  const quality = evaluateExtractionQuality(snapshot);
  assert.equal(quality.qualityStatus, "healthy");
  assert.equal(quality.pagesFound, 1);
  assert.equal(quality.pagesWithTitles, 1);
  assert.equal(quality.totalSections, 1);
  assert.ok(quality.qualityScore >= 0.7);
});

test("recognizes a baseline-aware empty-section degradation", () => {
  const previous = normalizeBrightDataResult([{ title: "Docs", description: "Overview", sections: [{ heading: "Start", content: "Read this." }, { heading: "API", content: "Use the API." }], api_endpoints: [{ method: "GET", path: "/v1/docs", description: "Docs" }], code_examples: [{ label: "curl", code: "curl /docs" }] }], "https://docs.example.test");
  const current = normalizeBrightDataResult([{ title: "Docs", description: "Overview", sections: [], api_endpoints: [], code_examples: [] }], "https://docs.example.test");
  const quality = evaluateExtractionQuality(current, previous);
  assert.equal(quality.qualityStatus, "degraded");
  assert.equal(quality.totalSections, 0);
  assert.match(quality.explanation, /collapsed/i);
});

test("handles malformed Bright Data output without throwing", () => {
  const snapshot = normalizeBrightDataResult(null, "https://docs.example.test", "2026-08-23T00:00:00.000Z");
  const quality = evaluateExtractionQuality(snapshot);
  assert.deepEqual(snapshot.pages, []);
  assert.equal(quality.qualityStatus, "failed");
  assert.equal(quality.pagesFound, 0);
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

  const result = await client.scrape("https://docs.example.test");
  assert.deepEqual(result, [{ title: "Docs" }]);
  assert.equal(requests.length, 3);
  assert.match(requests[0].url, /trigger_immediate\?collector=c_test$/);
  assert.equal(requests[0].init?.headers && (requests[0].init.headers as Record<string, string>).Authorization, "Bearer test-key");
  assert.equal(requests[0].init?.body, JSON.stringify({ url: "https://docs.example.test" }));
  assert.match(requests[1].url, /get_result\?response_id=response-123$/);
});
