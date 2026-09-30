import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { authorizedMobile, chromeCatalog, fileCatalog, queueBookmark, pendingBookmarks, acknowledgeBookmark } from "./mobile.mjs";

test("mobile catalog searches Chrome bookmarks and Tidymark files; saves are queued until acknowledged", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "tidymark-mobile-"));
  const original = Object.fromEntries(["MOBILE_CHROME_ROOT", "MOBILE_DOWNLOADS_ROOT", "MOBILE_TIDY_ROOT", "MOBILE_TOKEN", "DATA_DIR"].map((key) => [key, process.env[key]]));
  try {
    process.env.MOBILE_CHROME_ROOT = path.join(root, "Chrome");
    process.env.MOBILE_DOWNLOADS_ROOT = path.join(root, "Downloads");
    process.env.MOBILE_TIDY_ROOT = path.join(root, "Tidymark");
    process.env.DATA_DIR = path.join(root, "data");
    process.env.MOBILE_TOKEN = "example-token-longer-than-twenty-four-characters";
    await mkdir(path.join(root, "Chrome", "Default"), { recursive: true });
    await mkdir(path.join(root, "Downloads"));
    await mkdir(path.join(root, "Tidymark", "Travel"), { recursive: true });
    await writeFile(path.join(root, "Tidymark", "Travel", "Portugal.pdf"), "fixture");
    await writeFile(path.join(root, "Chrome", "Default", "Bookmarks"), JSON.stringify({ roots: {
      bookmark_bar: { id: "1", name: "Bookmarks bar", type: "folder", children: [
        { id: "10", name: "Travel", type: "folder", children: [
          { id: "11", name: "Portugal guide", type: "url", url: "https://example.com/portugal" },
        ] },
      ] },
    } }));
    const catalog = await chromeCatalog();
    assert.equal(catalog.folders[0].path, "Travel");
    assert.equal(catalog.bookmarks[0].path, "Travel");
    assert.equal((await fileCatalog())[0].path, "Travel/Portugal.pdf");
    assert.equal(authorizedMobile({ headers: { authorization: `Bearer ${process.env.MOBILE_TOKEN}` } }), true);
    assert.equal(authorizedMobile({ headers: { authorization: "Bearer wrong" } }), false);
    const saved = await queueBookmark({ url: "https://example.com/new", title: "New", folderId: "10" });
    assert.equal((await pendingBookmarks()).length, 1);
    assert.equal((await queueBookmark({ url: saved.url, folderId: "10" })).id, saved.id);
    assert.equal(await acknowledgeBookmark(saved.id), true);
    assert.equal((await pendingBookmarks()).length, 0);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
