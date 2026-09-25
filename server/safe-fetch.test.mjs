import assert from "node:assert/strict";
import test from "node:test";
import { createSafeFetch, isBlockedAddress } from "./safe-fetch.mjs";
import { createRateLimiter } from "./rate-limit.mjs";

test("blocks private, loopback, link-local and metadata addresses", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "142.250.1.1", "2606:4700::1111"]) assert.equal(isBlockedAddress(ip), false, ip);
});

test("rejects hosts that resolve to a private address", async () => {
  const safeFetch = createSafeFetch({ resolve: async () => [{ address: "10.0.0.5" }], fetchImpl: () => assert.fail("fetched") });
  await assert.rejects(safeFetch("http://intranet.example/"), { code: "EBLOCKED" });
});

test("re-checks redirect targets", async () => {
  const resolve = async (host) => [{ address: host === "public.example" ? "93.184.216.34" : "127.0.0.1" }];
  const fetchImpl = async () => new Response(null, { status: 302, headers: { location: "http://localhost/admin" } });
  await assert.rejects(createSafeFetch({ resolve, fetchImpl })("http://public.example/"), { code: "EBLOCKED" });
});

test("follows safe redirects", async () => {
  const resolve = async () => [{ address: "93.184.216.34" }];
  let calls = 0;
  const fetchImpl = async (url) => (calls++ === 0
    ? new Response(null, { status: 301, headers: { location: "/next" } })
    : new Response(`ok ${url.pathname}`));
  const response = await createSafeFetch({ resolve, fetchImpl })("https://public.example/start");
  assert.equal(await response.text(), "ok /next");
});

test("rate limiter allows perMinute requests per key per minute", () => {
  let time = 0;
  const limiter = createRateLimiter({ perMinute: 2, now: () => time });
  assert.deepEqual([limiter.allow("a"), limiter.allow("a"), limiter.allow("a"), limiter.allow("b")], [true, true, false, true]);
  time = 60_000;
  assert.equal(limiter.allow("a"), true);
});
