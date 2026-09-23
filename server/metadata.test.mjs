import assert from "node:assert/strict";
import test from "node:test";
import { extractMetadata, fetchBookmarkMetadata } from "./metadata.mjs";

test("extractMetadata reads page title and descriptive meta values", () => {
  assert.deepEqual(extractMetadata(`
    <head><title>Fallback title</title>
    <meta name="description" content="A &amp; B > C">
    <meta property='og:title' content='Preferred title'>
    <meta name="keywords" content="code, docs">
    <meta property="og:site_name" content="Example">
    </head>`), {
    pageTitle: "Preferred title",
    description: "A & B > C",
    keywords: "code, docs",
    siteName: "Example",
  });
});

test("fetchBookmarkMetadata uses title and URL fallback when a page cannot be read", async () => {
  assert.deepEqual(await fetchBookmarkMetadata("chrome://settings"), {});
  assert.deepEqual(await fetchBookmarkMetadata("https://example.com", {
    fetchImpl: async () => { throw new Error("offline"); },
  }), {});
});
