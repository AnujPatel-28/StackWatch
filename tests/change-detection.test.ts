import assert from "node:assert/strict";
import { test } from "node:test";
import { detectDocumentationChanges } from "../lib/change-detection/detect.ts";
import { normalizeBrightDataResult } from "../lib/scraper/normalize.ts";
import { executeScrape } from "../lib/scraper/run-scrape.ts";
import { InMemorySnapshotRepository } from "../lib/snapshots/in-memory-repository.ts";

const sourceUrl = "https://stackwatch-demo.vercel.app/";
const projectsUrl = "https://stackwatch-demo.vercel.app/api/projects";

function docs(projectField: string) {
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
      url: projectsUrl,
      title: "Projects API",
      description: "Create and manage projects.",
      sections: [{ heading: "Create", content: `Send a ${projectField} field.` }],
      api_endpoints: [{ method: "POST", path: "/api/projects", description: `Create a project with a ${projectField} field.` }],
      code_examples: [{ label: "JavaScript", code: `client.projects.create({ ${projectField}: 'next' })` }],
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

const baseline = normalizeBrightDataResult(docs("framework"), sourceUrl);

test("a renamed request field is reported as a high severity api change", () => {
  const report = detectDocumentationChanges(baseline, normalizeBrightDataResult(docs("project_type"), sourceUrl));
  const apiChange = report.changes.find((item) => item.type === "api_change");

  assert.equal(report.changeDetected, true);
  assert.ok(apiChange, "expected an api_change");
  assert.equal(apiChange.severity, "high");
  assert.equal(apiChange.page, "Projects API");
  assert.match(apiChange.before, /framework/);
  assert.match(apiChange.after, /project_type/);
  assert.equal(report.changes[0].severity, "high");
});

test("identical documentation produces no changes", () => {
  const report = detectDocumentationChanges(baseline, normalizeBrightDataResult(docs("framework"), sourceUrl));
  assert.deepEqual(report, { changeDetected: false, changes: [] });
});

test("reordered scrape output is not a change", () => {
  const reordered = docs("framework").reverse().map((page) => ({
    ...page,
    sections: [...page.sections].reverse(),
    api_endpoints: [...page.api_endpoints].reverse(),
  }));
  assert.equal(detectDocumentationChanges(baseline, normalizeBrightDataResult(reordered, sourceUrl)).changeDetected, false);
});

test("added and removed pages are reported with the right severity", () => {
  const withoutWebhooks = docs("framework").filter((page) => !page.url.endsWith("/webhooks"));
  const report = detectDocumentationChanges(baseline, normalizeBrightDataResult(withoutWebhooks, sourceUrl));
  assert.equal(report.changes[0].type, "page_removed");
  assert.equal(report.changes[0].severity, "high");
});

test("a degraded run reports degradation and never a documentation change", async () => {
  const repository = new InMemorySnapshotRepository();
  await executeScrape({ sourceUrl, scraper: { scrape: async () => docs("framework") }, repository });
  const result = await executeScrape({
    sourceUrl,
    scraper: { scrape: async () => docs("framework").map((page) => ({ ...page, sections: [], api_endpoints: [], code_examples: [] })) },
    repository,
  });

  assert.equal(result.comparison.runStatus, "degraded");
  assert.equal(result.comparison.changeReport, undefined);
  assert.ok(result.comparison.degradationReason);
});

test("an incomplete extraction reports partial and never a documentation change", async () => {
  const repository = new InMemorySnapshotRepository();
  await executeScrape({ sourceUrl, scraper: { scrape: async () => docs("framework") }, repository });
  const result = await executeScrape({
    sourceUrl,
    scraper: { scrape: async () => docs("framework").map((page) => ({ ...page, title: "", description: "" })) },
    repository,
  });

  assert.equal(result.quality.qualityStatus, "partial");
  assert.equal(result.comparison.runStatus, "partial");
  assert.equal(result.comparison.changeReport, undefined);
});

test("a healthy documentation edit reports changed with a populated report", async () => {
  const repository = new InMemorySnapshotRepository();
  await executeScrape({ sourceUrl, scraper: { scrape: async () => docs("framework") }, repository });
  const result = await executeScrape({ sourceUrl, scraper: { scrape: async () => docs("project_type") }, repository });

  assert.equal(result.comparison.runStatus, "changed");
  assert.equal(result.comparison.changeReport?.changes[0].severity, "high");
});

test("the first run reports baseline and an unchanged rerun reports unchanged", async () => {
  const repository = new InMemorySnapshotRepository();
  const first = await executeScrape({ sourceUrl, scraper: { scrape: async () => docs("framework") }, repository });
  const second = await executeScrape({ sourceUrl, scraper: { scrape: async () => docs("framework") }, repository });

  assert.equal(first.comparison.runStatus, "baseline");
  assert.equal(second.comparison.runStatus, "unchanged");
  assert.equal(second.comparison.changeReport, undefined);
});
