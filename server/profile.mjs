import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchBookmarkMetadata } from "./metadata.mjs";

export const MAX_METADATA_BATCH = 25;
export const MAX_PROFILE_BOOKMARKS = 5_000;
export const MAX_LEAF_CATEGORIES = 24;
// Roughly 80k tokens of bookmark lines; leaves room for the prompt and answer.
export const LLM_CHAR_BUDGET = 240_000;

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function normalizeBookmark(bookmark) {
  return {
    id: cleanText(bookmark?.id, 200),
    title: cleanText(bookmark?.title, 500),
    url: cleanText(bookmark?.url, 2_000),
    folder: cleanText(bookmark?.folder ?? bookmark?.currentPath, 500),
  };
}

function normalizeMeta(meta) {
  return {
    pageTitle: cleanText(meta?.pageTitle, 500),
    description: cleanText(meta?.description, 2_000),
    keywords: cleanText(meta?.keywords, 500),
    siteName: cleanText(meta?.siteName, 200),
  };
}

function normalizeList(input, max) {
  const seen = new Set();
  return (Array.isArray(input) ? input : [])
    .map((bookmark) => ({ ...normalizeBookmark(bookmark), meta: normalizeMeta(bookmark?.meta) }))
    .filter((bookmark) => {
      if (!bookmark.id || (!bookmark.title && !bookmark.url) || seen.has(bookmark.id)) return false;
      seen.add(bookmark.id);
      return true;
    })
    .slice(0, max);
}

export function normalizeMetadataRequest(input) {
  const bookmarks = normalizeList(input?.bookmarks, MAX_METADATA_BATCH).map(({ meta, ...bookmark }) => bookmark);
  if (bookmarks.length === 0) throw new TypeError("메타정보를 읽을 북마크가 없습니다.");
  return { bookmarks };
}

export async function enrichBookmarks(input, { metadataFetch = fetchBookmarkMetadata, cache } = {}) {
  const { bookmarks } = normalizeMetadataRequest(input);
  const refresh = input?.refresh === true;
  let cached = 0;
  const results = await Promise.all(
    bookmarks.map(async (bookmark) => {
      const found = cache
        ? await cache.fetch(bookmark.url, { refresh })
        : { meta: await metadataFetch(bookmark.url), cached: false };
      if (found.cached) cached += 1;
      return { ...bookmark, meta: normalizeMeta(found.meta) };
    }),
  );
  return { results, cached };
}

export function normalizeProfileRequest(input) {
  const bookmarks = normalizeList(input?.bookmarks, MAX_PROFILE_BOOKMARKS);
  if (bookmarks.length < 3) throw new TypeError("관심사를 분석하려면 북마크가 3개 이상 필요합니다.");
  return { bookmarks };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function topCounts(values, limit) {
  const counts = new Map();
  for (const value of values) if (value) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

// Each level drops detail so large collections still fit the model's context.
const COMPACT_LEVELS = [
  { description: 200, keywords: 80 },
  { description: 100, keywords: 0 },
  { description: 0, keywords: 0 },
];

function compactLine(bookmark, level) {
  const title = bookmark.title || bookmark.meta.pageTitle || bookmark.url;
  const row = [cleanText(title, 120), hostOf(bookmark.url), bookmark.folder];
  if (level.description) row.push(cleanText(bookmark.meta.description, level.description));
  if (level.keywords) row.push(cleanText(bookmark.meta.keywords, level.keywords));
  while (row.length > 3 && !row.at(-1)) row.pop();
  return JSON.stringify(row);
}

export function compactForLlm(bookmarks, budget = LLM_CHAR_BUDGET) {
  for (const [index, level] of COMPACT_LEVELS.entries()) {
    const lines = bookmarks.map((bookmark) => compactLine(bookmark, level));
    const size = lines.reduce((sum, line) => sum + line.length + 1, 0);
    if (size <= budget) return { text: lines.join("\n"), level: index, included: bookmarks.length };
  }
  // Still too large: keep an evenly spaced sample of the barest lines.
  const lines = bookmarks.map((bookmark) => compactLine(bookmark, COMPACT_LEVELS.at(-1)));
  const average = lines.reduce((sum, line) => sum + line.length + 1, 0) / lines.length;
  const keep = Math.max(1, Math.floor(budget / average));
  const step = lines.length / keep;
  const sample = Array.from({ length: keep }, (_, index) => lines[Math.floor(index * step)]);
  return { text: sample.join("\n"), level: COMPACT_LEVELS.length, included: sample.length };
}

export function buildProfileMessages(bookmarks, compact) {
  const hosts = topCounts(bookmarks.map((bookmark) => hostOf(bookmark.url)), 25)
    .map(([host, count]) => `${host} (${count})`)
    .join(", ");
  const folders = topCounts(bookmarks.map((bookmark) => bookmark.folder), 25)
    .map(([folder, count]) => `${folder} (${count})`)
    .join(", ");
  const system = [
    "You are a meticulous librarian who studies a person's browser bookmarks.",
    "Infer what the person is genuinely interested in and design a bookmark folder structure that fits how they actually use the web.",
    "Write every human-readable string in Korean. Respond with a single JSON object and nothing else.",
  ].join(" ");
  const user = `아래는 한 사람의 Chrome 북마크 ${bookmarks.length}개입니다${
    compact.included < bookmarks.length ? ` (분량 때문에 ${compact.included}개만 균등 추출)` : ""
  }.
각 줄은 JSON 배열 [제목, 도메인, 현재 폴더, 페이지 설명?, 키워드?] 입니다.

자주 나오는 도메인: ${hosts || "(없음)"}
현재 폴더 분포: ${folders || "(없음)"}

<bookmarks>
${compact.text}
</bookmarks>

다음 스키마의 JSON만 출력하세요. 코드펜스나 설명을 붙이지 마세요.
{
  "summary": "이 사람의 관심사를 2~3문장으로 요약",
  "interests": [
    { "name": "관심 분야", "weight": 0-100 정수(북마크에서 차지하는 비중과 몰입도), "description": "왜 그렇게 판단했는지 한 문장", "evidence": ["근거가 된 북마크 제목이나 사이트 2~4개"] }
  ],
  "folderStructure": {
    "rootName": "정리 폴더 이름(짧게)",
    "categories": [
      { "name": "상위 폴더", "description": "무엇을 담는지", "children": [ { "name": "하위 폴더", "description": "무엇을 담는지" } ] }
    ]
  }
}

규칙:
- interests는 비중이 큰 순서로 5~10개.
- categories는 6~10개. 북마크가 충분히 많은 분야만 children(최대 4개)을 둡니다. 전체 말단 폴더는 ${MAX_LEAF_CATEGORIES}개 이하.
- 폴더 이름에는 "/" 문자를 쓰지 마세요. 짧고 구체적으로.
- 어디에도 맞지 않는 북마크를 위한 "기타" 같은 폴더를 하나 둡니다.`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function extractJson(text) {
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("LLM 응답에서 JSON을 찾지 못했습니다.");
  return JSON.parse(unfenced.slice(start, end + 1));
}

function folderName(value) {
  return cleanText(String(value ?? "").replaceAll("/", "·"), 60);
}

export function leafCategories(structure) {
  const leaves = structure.categories.flatMap((category) =>
    category.children.length
      ? category.children.map((child) => `${category.name} / ${child.name}`)
      : [category.name],
  );
  return leaves.length <= MAX_LEAF_CATEGORIES ? leaves : structure.categories.map((category) => category.name);
}

export function parseProfileResponse(text) {
  const raw = extractJson(text);
  const interests = (Array.isArray(raw.interests) ? raw.interests : [])
    .map((interest) => ({
      name: cleanText(interest?.name, 60),
      weight: Math.max(0, Math.min(100, Math.round(Number(interest?.weight) || 0))),
      description: cleanText(interest?.description, 300),
      evidence: (Array.isArray(interest?.evidence) ? interest.evidence : [])
        .map((item) => cleanText(String(item ?? ""), 120))
        .filter(Boolean)
        .slice(0, 5),
    }))
    .filter((interest) => interest.name)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12);

  const seen = new Set();
  const categories = (Array.isArray(raw.folderStructure?.categories) ? raw.folderStructure.categories : [])
    .map((category) => {
      const childSeen = new Set();
      return {
        name: folderName(category?.name),
        description: cleanText(category?.description, 200),
        children: (Array.isArray(category?.children) ? category.children : [])
          .map((child) => ({ name: folderName(child?.name), description: cleanText(child?.description, 200) }))
          .filter((child) => child.name && !childSeen.has(child.name) && childSeen.add(child.name))
          .slice(0, 6),
      };
    })
    .filter((category) => category.name && !seen.has(category.name) && seen.add(category.name))
    .slice(0, 16);
  if (categories.length < 2) throw new SyntaxError("LLM이 폴더 구조를 충분히 제안하지 않았습니다.");

  const folderStructure = {
    rootName: folderName(raw.folderStructure?.rootName) || "JEV 정리함",
    categories,
  };
  return {
    summary: cleanText(raw.summary, 1_000),
    interests,
    folderStructure,
    leafCategories: leafCategories(folderStructure),
  };
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
}

async function saveJson(dataDir, relativePath, data) {
  const file = path.join(dataDir, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return file;
}

export async function analyzeBookmarkProfile(poe, input, { model, dataDir, now = new Date() } = {}) {
  const { bookmarks } = normalizeProfileRequest(input);
  const snapshot = { createdAt: now.toISOString(), count: bookmarks.length, bookmarks };
  const snapshotFile = await saveJson(dataDir, `snapshots/bookmarks-${stamp(now)}.json`, snapshot);
  await saveJson(dataDir, "bookmarks-latest.json", snapshot);

  const savedAs = path.relative(process.cwd(), snapshotFile);

  const compact = compactForLlm(bookmarks);
  let answer;
  let profile;
  try {
    answer = await poe.chat({ model, messages: buildProfileMessages(bookmarks, compact) });
    profile = parseProfileResponse(answer.content);
  } catch (error) {
    error.message += ` (북마크 JSON은 ${savedAs}에 저장했습니다.)`;
    throw error;
  }
  const result = {
    createdAt: now.toISOString(),
    model: answer.model,
    coverage: { total: bookmarks.length, included: compact.included, detailLevel: compact.level },
    snapshotFile: savedAs,
    ...profile,
  };
  await saveJson(dataDir, `profiles/profile-${stamp(now)}.json`, result);
  await saveJson(dataDir, "profile-latest.json", result);
  return result;
}
