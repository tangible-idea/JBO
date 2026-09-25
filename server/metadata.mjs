import { outboundFetch } from "./safe-fetch.mjs";
const MAX_HTML_BYTES = 128 * 1024;
const METADATA_TIMEOUT_MS = 5_000;

function decodeEntities(value) {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
    if (entity.startsWith("#")) {
      const codePoint = entity[1]?.toLowerCase() === "x"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function readAttributes(tag) {
  const attributes = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]);
  }
  return attributes;
}

export function extractMetadata(html) {
  const head = html.split(/<\/head\s*>/i, 1)[0];
  const tags = [...head.matchAll(/<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)];
  const values = new Map();
  for (const [tag] of tags) {
    const attributes = readAttributes(tag);
    const key = (attributes.property || attributes.name || "").toLowerCase();
    if (key && attributes.content && !values.has(key)) values.set(key, attributes.content.trim());
  }
  const title = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1] || "";
  return {
    pageTitle: (values.get("og:title") || values.get("twitter:title") || decodeEntities(title)).trim().slice(0, 500),
    description: (values.get("description") || values.get("og:description") || values.get("twitter:description") || "").slice(0, 2_000),
    keywords: (values.get("keywords") || "").slice(0, 500),
    siteName: (values.get("og:site_name") || "").slice(0, 200),
  };
}

export async function fetchBookmarkMetadata(url, { fetchImpl = outboundFetch } = {}) {
  if (!/^https?:\/\//i.test(url)) return {};
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (!response.ok || !/^(text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get("content-type") || "")) {
      await response.body?.cancel();
      return {};
    }
    if (!response.body) return {};
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (size < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value.slice(0, MAX_HTML_BYTES - size));
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    const bytes = Buffer.concat(chunks);
    const charset = /charset\s*=\s*([^;\s]+)/i.exec(response.headers.get("content-type") || "")?.[1] || "utf-8";
    let decoder;
    try { decoder = new TextDecoder(charset); } catch { decoder = new TextDecoder(); }
    return extractMetadata(decoder.decode(bytes));
  } catch {
    return {};
  }
}
