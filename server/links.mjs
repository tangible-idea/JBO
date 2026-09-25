import { outboundFetch } from "./safe-fetch.mjs";
export const MAX_LINK_BATCH = 25;
const LINK_TIMEOUT_MS = 8_000;

// Only answers that reliably mean "this page is gone" count as dead. Sites often
// block bots with 401/403/429 or fail briefly with 5xx, so those stay "unknown".
const GONE_STATUSES = new Set([404, 410]);
const GONE_ERROR_CODES = new Set(["ENOTFOUND"]);

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeLinkRequest(input) {
  const seen = new Set();
  const bookmarks = (Array.isArray(input?.bookmarks) ? input.bookmarks : [])
    .map((bookmark) => ({ id: cleanText(bookmark?.id, 200), url: cleanText(bookmark?.url, 2_000) }))
    .filter((bookmark) => bookmark.id && bookmark.url && !seen.has(bookmark.id) && seen.add(bookmark.id))
    .slice(0, MAX_LINK_BATCH);
  if (bookmarks.length === 0) throw new TypeError("확인할 북마크가 없습니다.");
  return { bookmarks };
}

function errorCode(error) {
  return error?.cause?.code || error?.code || "";
}

export async function checkLink(url, { fetchImpl = outboundFetch } = {}) {
  if (!/^https?:\/\//i.test(url)) return { state: "skipped", reason: "웹 주소가 아니에요" };
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
      headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    });
    await response.body?.cancel().catch(() => {});
    if (GONE_STATUSES.has(response.status)) {
      return { state: "dead", status: response.status, reason: `페이지 없음 (${response.status})` };
    }
    if (response.ok) return { state: "alive", status: response.status };
    return { state: "unknown", status: response.status, reason: `응답 ${response.status}` };
  } catch (error) {
    const code = errorCode(error);
    if (code === "EBLOCKED") return { state: "skipped", reason: "내부 네트워크 주소예요" };
    if (GONE_ERROR_CODES.has(code)) return { state: "dead", reason: "도메인이 없어요" };
    if (error?.name === "TimeoutError") return { state: "unknown", reason: "응답 없음" };
    return { state: "unknown", reason: code || "연결 실패" };
  }
}

export async function checkLinks(input, options) {
  const { bookmarks } = normalizeLinkRequest(input);
  const results = await Promise.all(
    bookmarks.map(async (bookmark) => ({ id: bookmark.id, url: bookmark.url, ...(await checkLink(bookmark.url, options)) })),
  );
  return { results };
}
