import assert from "node:assert/strict";
import { test } from "node:test";
import { BrightDataHealClient } from "../lib/scraper/bright-data-heal.ts";
import { createHealingJob, getHealingJob, updateHealingJob } from "../lib/healing/job-store.ts";
import { readFileSync } from "node:fs";

test("Bright Data healing follows the refactor, progress, and approval contract", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [new Response(JSON.stringify({ status: "started" })), new Response(JSON.stringify({ status: "pending_answer", step: "review" })), new Response(JSON.stringify({ status: "done" }))];
  const client = new BrightDataHealClient({ apiKey: "key", collectorId: "collector", pollIntervalMs: 0, sleep: async () => undefined, fetchImpl: async (url, init) => {
    requests.push({ url: String(url), init });
    return responses.shift() as Response;
  } });
  await client.start("repair extraction");
  const gate = await client.pollUntilGate(() => undefined);
  await client.approve(true);
  assert.equal(gate.status, "pending_answer");
  assert.equal(requests[0].init?.body, JSON.stringify({ prompt: "repair extraction", custom_input: [] }));
  assert.match(requests[1].url, /refactor_template\/progress$/);
  assert.equal(requests[2].init?.body, JSON.stringify({ message: true, auto_save: true }));
});

test("healing jobs persist across module reads through the global store", () => {
  const job = createHealingJob({ sourceUrl: "https://docs.example.com/", prompt: "repair", previousQualityScore: 0.42 });
  const updated = updateHealingJob(job.id, { state: "awaiting_approval" });
  assert.equal(updated?.state, "awaiting_approval");
  assert.equal(getHealingJob(job.id)?.previousQualityScore, 0.42);
});

test("the real Bright Data approval-gate payload stops polling at the gate", async () => {
  const gatePayload = JSON.parse(readFileSync(new URL("./fixtures/heal-awaiting-approval.json", import.meta.url), "utf8"));
  const responses = [
    { status: "running", step: "code_fixer" },
    { status: "running", step: "request_fulfillment_validator" },
    gatePayload,
  ];
  const seen: string[] = [];
  const client = new BrightDataHealClient({
    apiKey: "test-key",
    collectorId: "c_test",
    pollIntervalMs: 0,
    sleep: async () => undefined,
    fetchImpl: async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { "content-type": "application/json" } }),
  });

  const gate = await client.pollUntilGate((progress) => seen.push(progress.status));
  assert.equal(gate.status, "pending_answer");
  assert.deepEqual(seen, ["running", "running", "pending_answer"]);
  assert.equal(gate.step, "user_approval");
});

test("rejecting a heal omits auto_save so the template is never saved", async () => {
  const bodies: string[] = [];
  const client = new BrightDataHealClient({
    apiKey: "test-key",
    collectorId: "c_test",
    fetchImpl: async (_input, init) => {
      bodies.push(String(init?.body));
      return new Response(JSON.stringify({ status: "done" }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  await client.approve(false);
  await client.approve(true);
  assert.deepEqual(JSON.parse(bodies[0]), { message: false });
  assert.deepEqual(JSON.parse(bodies[1]), { message: true, auto_save: true });
});

test("a concurrent refactor job recovers by falling through to progress", async () => {
  let callCount = 0;
  const client = new BrightDataHealClient({
    apiKey: "test-key",
    collectorId: "c_test",
    fetchImpl: async () => {
      callCount++;
      if (callCount === 1) return new Response(JSON.stringify({ error: "Another refactor job is still in progress" }), { status: 409 });
      return new Response(JSON.stringify({ status: "running", step: "code_fixer", completed_steps: ["planner"] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const result = await client.start("fix the selectors");
  assert.equal(callCount, 2);
  assert.equal(result.status, "running");
  assert.equal(result.step, "code_fixer");
});

test("a rejected healing request retains Bright Data's status and response body", async () => {
  const rejectedBody = { error: { field: "custom_input", message: "must be an array" } };
  const client = new BrightDataHealClient({
    apiKey: "test-key",
    collectorId: "c_test",
    fetchImpl: async () => new Response(JSON.stringify(rejectedBody), { status: 400, headers: { "content-type": "application/json" } }),
  });

  await assert.rejects(
    () => client.start("fix the selectors"),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      assert.match((error as Error).message, /HTTP 400:.*custom_input/);
      assert.equal((error as { statusCode?: number }).statusCode, 400);
      assert.deepEqual((error as { responseBody?: unknown }).responseBody, rejectedBody);
      return true;
    },
  );
});
