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

export async function enrichBookmarks(input, { metadataFetch = fetchBookmarkMetadata, cache, onResult } = {}) {
  const { bookmarks } = normalizeMetadataRequest(input);
  const refresh = input?.refresh === true;
  let cached = 0;
  const results = await Promise.all(
    bookmarks.map(async (bookmark) => {
      const found = cache
        ? await cache.fetch(bookmark.url, { refresh })
        : { meta: await metadataFetch(bookmark.url), cached: false };
      if (found.cached) cached += 1;
      const result = { ...bookmark, meta: normalizeMeta(found.meta) };
      onResult?.(result, { cached: found.cached });
      return result;
    }),
  );
  return { results, cached };
}

export function normalizeProfileRequest(input) {
  const bookmarks = normalizeList(input?.bookmarks, MAX_PROFILE_BOOKMARKS);
  if (bookmarks.length < 3) throw new TypeError("관심사를 분석하려면 북마크가 3개 이상 필요합니다.");
  return { bookmarks, folderLanguage: input?.folderLanguage === "en" ? "en" : "ko" };
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

// Only what the model needs: title, site, and the folder the person chose.
// Folder paths are written once as headings instead of on every line, and page
// descriptions are added only when the title alone says too little.
const SHORT_TITLE = 15;
const COMPACT_LEVELS = [{ description: 80 }, { description: 0 }];

function isWebBookmark(bookmark) {
  return /^https?:\/\//i.test(bookmark.url);
}

function compactItem(bookmark, level) {
  const title = cleanText(bookmark.title || bookmark.meta.pageTitle, 80);
  const host = hostOf(bookmark.url);
  let line = title ? `${title} (${host})` : host;
  if (level.description && title.length < SHORT_TITLE) {
    const description = cleanText(bookmark.meta.description, level.description);
    if (description) line += ` — ${description}`;
  }
  return line;
}

function groupByFolder(bookmarks, level) {
  const groups = new Map();
  for (const bookmark of bookmarks) {
    const folder = bookmark.folder || "(최상위)";
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(compactItem(bookmark, level));
  }
  return [...groups].map(([folder, lines]) => `## ${folder}\n${lines.join("\n")}`).join("\n");
}

export function compactForLlm(bookmarks, budget = LLM_CHAR_BUDGET) {
  const web = bookmarks.filter(isWebBookmark);
  for (const [index, level] of COMPACT_LEVELS.entries()) {
    const text = groupByFolder(web, level);
    if (text.length <= budget) return { text, level: index, included: web.length };
  }
  // Still too large: keep an evenly spaced sample of the barest lines.
  const bare = COMPACT_LEVELS.at(-1);
  let keep = Math.max(1, Math.floor((web.length * budget) / groupByFolder(web, bare).length));
  for (;;) {
    const step = web.length / keep;
    const sample = Array.from({ length: keep }, (_, index) => web[Math.floor(index * step)]);
    const text = groupByFolder(sample, bare);
    if (text.length <= budget || keep === 1) {
      return { text, level: COMPACT_LEVELS.length, included: sample.length };
    }
    keep = Math.max(1, Math.floor(keep * 0.9));
  }
}

export function buildProfileMessages(bookmarks, compact, folderLanguage = "ko") {
  const hosts = topCounts(bookmarks.map((bookmark) => hostOf(bookmark.url)), 25)
    .map(([host, count]) => `${host} (${count})`)
    .join(", ");
  const system = [
    "You are a meticulous librarian who studies a person's browser bookmarks.",
    "Infer what the person is genuinely interested in and design a bookmark folder structure that fits how they actually use the web.",
    folderLanguage === "en"
      ? "Write only folderStructure.rootName and every folderStructure.categories name and children name in natural English. Write the summary, interests, evidence, and folder descriptions in Korean. Respond with a single JSON object and nothing else."
      : "Write every human-readable string in Korean. Respond with a single JSON object and nothing else.",
  ].join(" ");
  const user = `아래는 한 사람의 Chrome 북마크 ${bookmarks.length}개입니다${
    compact.included < bookmarks.length ? ` (웹 주소가 아니거나 분량 때문에 ${compact.included}개만 포함)` : ""
  }.
"## 폴더 경로" 아래에 그 폴더의 북마크가 "제목 (도메인)" 형식으로 한 줄씩 있습니다. 제목이 짧으면 " — 페이지 설명"이 붙습니다.

자주 나오는 도메인: ${hosts || "(없음)"}

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
- 어디에도 맞지 않는 북마크를 위한 ${folderLanguage === "en" ? '"Other"' : '"기타"'} 같은 폴더를 하나 둡니다.
- ${folderLanguage === "en" ? "최상위 폴더와 모든 상위·하위 폴더 이름은 영어로 쓰세요. 요약, 관심 분야, 근거, 폴더 설명은 한국어로 쓰세요." : "최상위 폴더와 모든 상위·하위 폴더 이름은 한국어로 쓰세요."}`;
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

export function normalizeFolderLanguageRequest(input) {
  if (!['ko', 'en'].includes(input?.folderLanguage)) throw new TypeError('폴더 이름 언어를 선택하세요.');
  const source = input?.folderStructure;
  const rootName = folderName(source?.rootName);
  const categories = Array.isArray(source?.categories) ? source.categories : [];
  if (!rootName || categories.length < 2 || categories.length > 16) throw new TypeError('변경할 폴더 구조가 올바르지 않습니다.');
  const structure = {
    rootName,
    categories: categories.map((category) => {
      const name = folderName(category?.name);
      const children = Array.isArray(category?.children) ? category.children : [];
      if (!name || children.length > 6) throw new TypeError('변경할 폴더 구조가 올바르지 않습니다.');
      return {
        name,
        description: cleanText(category?.description, 200),
        children: children.map((child) => {
          const childName = folderName(child?.name);
          if (!childName) throw new TypeError('변경할 폴더 구조가 올바르지 않습니다.');
          return { name: childName, description: cleanText(child?.description, 200) };
        }),
      };
    }),
  };
  return { folderLanguage: input.folderLanguage, folderStructure: structure };
}

export async function translateFolderStructure(poe, input, { model } = {}) {
  const { folderLanguage, folderStructure } = normalizeFolderLanguageRequest(input);
  const originalNames = [folderStructure.rootName];
  for (const category of folderStructure.categories) {
    originalNames.push(category.name);
    for (const child of category.children) originalNames.push(child.name);
  }
  const target = folderLanguage === 'en' ? 'English' : 'Korean';
  const answer = await poe.chat({
    model,
    maxTokens: 4_000,
    temperature: 0.1,
    messages: [
      { role: 'system', content: `Translate bookmark folder names into concise, natural ${target}. Preserve their meaning and order. Use the descriptions and hierarchy for context. Do not translate descriptions. Return only a JSON object with a names array of exactly ${originalNames.length} strings, ordered as root name first, then each category name immediately followed by its child names. Do not add, remove, or merge folders.` },
      { role: 'user', content: JSON.stringify({ folderStructure, output: { names: originalNames.map(() => '') } }) },
    ],
  });
  const translated = extractJson(answer.content).names;
  if (!Array.isArray(translated) || translated.length !== originalNames.length) {
    throw new SyntaxError('번역된 폴더 이름의 개수가 맞지 않습니다.');
  }
  const names = translated.map(folderName);
  if (names.some((name) => !name) || (folderLanguage === 'en' && names.some((name) => /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(name)))) {
    throw new SyntaxError('폴더 이름을 선택한 언어로 변환하지 못했습니다.');
  }
  let index = 0;
  const translatedStructure = {
    rootName: names[index++],
    categories: folderStructure.categories.map((category) => ({
      ...category,
      name: names[index++],
      children: category.children.map((child) => ({ ...child, name: names[index++] })),
    })),
  };
  const categoryNames = translatedStructure.categories.map((category) => category.name);
  if (new Set(categoryNames).size !== categoryNames.length || translatedStructure.categories.some((category) =>
    new Set(category.children.map((child) => child.name)).size !== category.children.length
  )) throw new SyntaxError('번역된 폴더 이름이 중복됩니다.');
  return { folderStructure: translatedStructure, leafCategories: leafCategories(translatedStructure) };
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
    rootName: folderName(raw.folderStructure?.rootName) || "Tidymark",
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
  const { bookmarks, folderLanguage } = normalizeProfileRequest(input);
  const snapshot = { createdAt: now.toISOString(), count: bookmarks.length, bookmarks };
  const snapshotFile = await saveJson(dataDir, `snapshots/bookmarks-${stamp(now)}.json`, snapshot);
  await saveJson(dataDir, "bookmarks-latest.json", snapshot);

  const savedAs = path.relative(process.cwd(), snapshotFile);

  const compact = compactForLlm(bookmarks);
  let answer;
  let profile;
  try {
    // The report is long Korean JSON; 4k tokens cut it off mid-structure.
    answer = await poe.chat({ model, messages: buildProfileMessages(bookmarks, compact, folderLanguage), maxTokens: 16_000 });
    profile = parseProfileResponse(answer.content);
  } catch (error) {
    error.message += ` (북마크 JSON은 ${savedAs}에 저장했습니다.)`;
    throw error;
  }
  const result = {
    createdAt: now.toISOString(),
    model: answer.model,
    folderLanguage,
    coverage: { total: bookmarks.length, included: compact.included, detailLevel: compact.level },
    snapshotFile: savedAs,
    ...profile,
  };
  await saveJson(dataDir, `profiles/profile-${stamp(now)}.json`, result);
  await saveJson(dataDir, "profile-latest.json", result);
  return result;
}
