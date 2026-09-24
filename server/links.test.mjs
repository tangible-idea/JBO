import assert from "node:assert/strict";
import test from "node:test";
import { checkLink, checkLinks, normalizeLinkRequest } from "./links.mjs";

const respond = (status) => async () => new Response("", { status });

test("checkLink only calls 404, 410 and missing domains dead", async () => {
  assert.equal((await checkLink("https://a.example", { fetchImpl: respond(404) })).state, "dead");
  assert.equal((await checkLink("https://a.example", { fetchImpl: respond(410) })).state, "dead");
  assert.equal((await checkLink("https://a.example", { fetchImpl: respond(200) })).state, "alive");
  assert.equal((await checkLink("https://a.example", { fetchImpl: respond(403) })).state, "unknown");
  assert.equal((await checkLink("https://a.example", { fetchImpl: respond(503) })).state, "unknown");

  const missingDomain = async () => {
    throw new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } });
  };
  assert.equal((await checkLink("https://gone.example", { fetchImpl: missingDomain })).state, "dead");
  const refused = async () => {
    throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
  };
  assert.equal((await checkLink("https://down.example", { fetchImpl: refused })).state, "unknown");
});

test("checkLink skips non-web URLs without fetching", async () => {
  let called = false;
  const result = await checkLink("chrome://settings", { fetchImpl: async () => { called = true; } });
  assert.equal(result.state, "skipped");
  assert.equal(called, false);
});

test("checkLinks keeps ids and rejects empty batches", async () => {
  const { results } = await checkLinks({ bookmarks: [{ id: "1", url: "https://a.example" }] }, { fetchImpl: respond(404) });
  assert.equal(results[0].id, "1");
  assert.equal(results[0].state, "dead");
  assert.throws(() => normalizeLinkRequest({ bookmarks: [] }), TypeError);
});
