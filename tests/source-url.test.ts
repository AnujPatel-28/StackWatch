import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSourceUrl } from "../lib/scraper/source-url.ts";

test("source URLs accept HTTP and HTTPS and remove hashes and trailing slashes", () => {
  assert.deepEqual(validateSourceUrl(" https://docs.example.com/guides/#install "), { ok: true, url: "https://docs.example.com/guides" });
  assert.deepEqual(validateSourceUrl("http://docs.example.com/"), { ok: true, url: "http://docs.example.com/" });
});

test("source URLs reject empty, malformed, and non-web protocols", () => {
  assert.equal(validateSourceUrl("").ok, false);
  assert.equal(validateSourceUrl("not a url").ok, false);
  assert.deepEqual(validateSourceUrl("file:///private/docs"), { ok: false, reason: "Documentation URLs must use HTTP or HTTPS." });
});
