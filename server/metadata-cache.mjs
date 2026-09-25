import { readFile, stat } from "node:fs/promises";
import { fetchBookmarkMetadata } from "./metadata.mjs";

function hasMeta(meta) {
  return Boolean(meta && Object.values(meta).some((value) => typeof value === "string" && value.trim()));
}

// Reuses page metadata from the saved bookmark snapshot so pages are not fetched again.
// The snapshot is re-read only when the file changes.
export function createMetadataCache(snapshotFile, { fetchMetadata = fetchBookmarkMetadata } = {}) {
  let byUrl = new Map();
  let loadedMtime = null;
  let loading = null;

  async function reload() {
    try {
      const { mtimeMs } = await stat(snapshotFile);
      if (mtimeMs === loadedMtime) return byUrl;
      const snapshot = JSON.parse(await readFile(snapshotFile, "utf8"));
      const next = new Map();
      for (const bookmark of snapshot.bookmarks || []) {
        if (bookmark?.url && hasMeta(bookmark.meta)) next.set(bookmark.url, bookmark.meta);
      }
      byUrl = next;
      loadedMtime = mtimeMs;
    } catch (error) {
      if (error.code !== "ENOENT") console.warn(`메타정보 캐시를 읽지 못했습니다: ${error.message}`);
      byUrl = new Map();
      loadedMtime = null;
    }
    return byUrl;
  }

  function load() {
    loading ??= reload().finally(() => {
      loading = null;
    });
    return loading;
  }

  return {
    async fetch(url, { refresh = false } = {}) {
      if (!refresh) {
        const cached = (await load()).get(url);
        if (cached) return { meta: cached, cached: true };
      }
      return { meta: await fetchMetadata(url), cached: false };
    },
  };
}

// In-memory cache for shared deployments: page metadata only, bounded, never on disk.
export function createMemoryMetadataCache({ fetchMetadata = fetchBookmarkMetadata, maxEntries = 5_000 } = {}) {
  const byUrl = new Map();
  return {
    async fetch(url, { refresh = false } = {}) {
      if (!refresh && byUrl.has(url)) return { meta: byUrl.get(url), cached: true };
      const meta = await fetchMetadata(url);
      if (hasMeta(meta)) {
        byUrl.delete(url);
        byUrl.set(url, meta);
        if (byUrl.size > maxEntries) byUrl.delete(byUrl.keys().next().value);
      }
      return { meta, cached: false };
    },
  };
}
