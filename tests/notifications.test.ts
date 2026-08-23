import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChangeMessage, buildDegradationMessage, buildRecoveryMessage } from "../lib/notifications/messages.ts";
import { TelegramClient } from "../lib/notifications/telegram.ts";

const sourceUrl = "https://docs.example.com/";

test("notification messages describe the three supported events", () => {
  const change = buildChangeMessage(sourceUrl, { changeDetected: true, changes: [{ type: "api_change", page: "Projects", summary: "Projects API request schema changed.", before: "framework", after: "project_type", severity: "high" }] });
  assert.match(change, /🚨 StackWatch Documentation Change/);
  assert.match(change, /HIGH/);
  assert.match(buildDegradationMessage(sourceUrl, "structured content collapsed", 0.42), /42%/);
  assert.equal(buildRecoveryMessage(sourceUrl, 0.42, 0.98), "✅ StackWatch Scraper Recovered\n\nSource:\nhttps://docs.example.com/\n\nQuality:\n42% → 98%\n\nThe scraper was successfully repaired and re-run.");
});

test("telegram delivery is safely skipped when credentials are absent", async () => {
  const client = new TelegramClient({ fetchImpl: async () => { throw new Error("should not fetch"); } });
  assert.deepEqual(await client.sendMessage("hello"), { delivered: false, reason: "not configured" });
});

test("telegram sends only through the injected fetch implementation", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = new TelegramClient({ token: "token", chatId: "chat", fetchImpl: async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } });
  assert.deepEqual(await client.sendMessage("hello"), { delivered: true });
  assert.equal(requests[0].url, "https://api.telegram.org/bottoken/sendMessage");
  assert.equal(requests[0].init?.body, JSON.stringify({ chat_id: "chat", text: "hello" }));
});
