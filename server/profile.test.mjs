import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { writeFile } from "node:fs/promises";
import { createMetadataCache } from "./metadata-cache.mjs";
import { createPoeClient } from "./poe.mjs";
import {
  analyzeBookmarkProfile,
  buildProfileMessages,
  compactForLlm,
  enrichBookmarks,
  leafCategories,
  MAX_LEAF_CATEGORIES,
  normalizeProfileRequest,
  normalizeFolderLanguageRequest,
  parseProfileResponse,
  translateFolderStructure,
} from "./profile.mjs";

const bookmarks = [
  { id: "1", title: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs", folder: "북마크바 / 개발", meta: { description: "Learn TypeScript" } },
  { id: "2", title: "Rust Book", url: "https://doc.rust-lang.org/book", folder: "기타 북마크" },
  { id: "3", title: "도쿄 맛집", url: "https://tabelog.com", folder: "기타 북마크" },
];

const llmAnswer = {
  summary: "개발과 여행에 관심이 많습니다.",
  interests: [
    { name: "여행", weight: 20, description: "맛집", evidence: ["도쿄 맛집"] },
    { name: "프로그래밍", weight: 80.4, description: "문서", evidence: ["TypeScript Handbook", "Rust Book"] },
  ],
  folderStructure: {
    rootName: "내 서재",
    categories: [
      { name: "개발/코딩", description: "개발", children: [{ name: "언어", description: "" }, { name: "언어" }] },
      { name: "여행", description: "여행" },
      { name: "여행" },
    ],
  },
};

test("parseProfileResponse accepts fenced JSON and normalizes names and weights", () => {
  const profile = parseProfileResponse(`\`\`\`json\n${JSON.stringify(llmAnswer)}\n\`\`\``);
  assert.deepEqual(profile.interests.map((interest) => [interest.name, interest.weight]), [["프로그래밍", 80], ["여행", 20]]);
  assert.equal(profile.folderStructure.categories.length, 2);
  assert.equal(profile.folderStructure.categories[0].name, "개발·코딩");
  assert.equal(profile.folderStructure.categories[0].children.length, 1);
  assert.deepEqual(profile.leafCategories, ["개발·코딩 / 언어", "여행"]);
});

test("parseProfileResponse rejects answers without a usable structure", () => {
  assert.throws(() => parseProfileResponse("죄송합니다"), SyntaxError);
  assert.throws(() => parseProfileResponse('{"folderStructure":{"categories":[{"name":"하나"}]}}'), SyntaxError);
});

test("folder language applies only to recommended folder names", () => {
  assert.equal(normalizeProfileRequest({ bookmarks }).folderLanguage, "ko");
  assert.equal(normalizeProfileRequest({ bookmarks, folderLanguage: "en" }).folderLanguage, "en");
  const compact = compactForLlm(normalizeProfileRequest({ bookmarks }).bookmarks);
  const messages = buildProfileMessages(bookmarks, compact, "en");
  assert.match(messages[0].content, /rootName.*natural English/);
  assert.match(messages[0].content, /summary, interest names, interest descriptions, evidence and folder descriptions in Korean/);
  assert.match(messages[1].content, /"Other"/);
});

test("report language is independent of folder language", () => {
  assert.equal(normalizeProfileRequest({ bookmarks }).reportLanguage, "ko");
  assert.equal(normalizeProfileRequest({ bookmarks, reportLanguage: "en" }).reportLanguage, "en");
  const compact = compactForLlm(normalizeProfileRequest({ bookmarks }).bookmarks);
  const messages = buildProfileMessages(bookmarks, compact, "ko", "en");
  assert.match(messages[0].content, /folder name in natural Korean/);
  assert.match(messages[0].content, /folder descriptions in English/);
});

test("changing folder language preserves the folder tree and descriptions", async () => {
  const original = parseProfileResponse(JSON.stringify(llmAnswer)).folderStructure;
  const seen = [];
  const poe = { async chat(request) {
    seen.push(request);
    return { content: JSON.stringify({ names: ["My Library", "Development", "Languages", "Travel"] }) };
  } };
  const result = await translateFolderStructure(poe, { folderStructure: original, folderLanguage: "en" }, { model: "Claude-Test" });
  assert.deepEqual(result.leafCategories, ["Development / Languages", "Travel"]);
  assert.equal(result.folderStructure.categories[0].description, "개발");
  assert.equal(result.folderStructure.categories[0].children[0].description, "");
  assert.match(seen[0].messages[0].content, /English/);
  assert.equal(seen[0].model, "Claude-Test");
  assert.throws(() => normalizeFolderLanguageRequest({ folderStructure: original, folderLanguage: "fr" }), TypeError);
  await assert.rejects(
    translateFolderStructure({ chat: async () => ({ content: '{"names":["Only one"]}' }) }, { folderStructure: original, folderLanguage: "en" }),
    /개수가 맞지/,
  );
});

test("leafCategories falls back to top-level folders when there are too many leaves", () => {
  const categories = Array.from({ length: 7 }, (_, index) => ({
    name: `C${index}`,
    children: Array.from({ length: 4 }, (_, child) => ({ name: `L${child}` })),
  }));
  assert.ok(7 * 4 > MAX_LEAF_CATEGORIES);
  assert.deepEqual(leafCategories({ categories }), categories.map((category) => category.name));
});

test("compactForLlm groups by folder and describes only short titles", () => {
  const bookmarks = [
    { title: "Settings", url: "https://a.example/s", folder: "Work", meta: { description: "Account settings page" } },
    { title: "A descriptive long bookmark title", url: "https://b.example", folder: "Work", meta: { description: "unused" } },
    { title: "Home", url: "chrome://newtab/", folder: "Work", meta: { description: "" } },
    { title: "Docs", url: "https://c.example", folder: "Dev", meta: { description: "" } },
  ];
  const { text, level, included } = compactForLlm(bookmarks, 1_000_000);
  assert.equal(level, 0);
  assert.equal(included, 3);
  assert.equal(text.match(/## Work/g).length, 1);
  assert.match(text, /Settings \(a\.example\) — Account settings page/);
  assert.doesNotMatch(text, /unused/);
  assert.doesNotMatch(text, /chrome:/);
});

test("compactForLlm drops detail, then samples, to stay within budget", () => {
  const many = Array.from({ length: 400 }, (_, index) => ({
    title: `Bookmark ${index}`,
    url: `https://site${index}.example.com/page`,
    folder: "기타",
    meta: { description: "x".repeat(300), keywords: "a, b, c" },
  }));
  const full = compactForLlm(many, 1_000_000);
  assert.equal(full.level, 0);
  assert.equal(full.included, 400);
  const bare = compactForLlm(many, 15_000);
  assert.equal(bare.level, 1);
  assert.ok(bare.text.length <= 15_000);
  const sampled = compactForLlm(many, 5_000);
  assert.equal(sampled.level, 2);
  assert.ok(sampled.included < 400 && sampled.text.length <= 5_000);
});

test("enrichBookmarks attaches normalized page metadata", async () => {
  const { results } = await enrichBookmarks(
    { bookmarks: [{ id: "1", title: "A", url: "https://a.example", currentPath: "기타" }] },
    { metadataFetch: async () => ({ description: "  hello   world ", junk: true }) },
  );
  assert.equal(results[0].folder, "기타");
  assert.deepEqual(results[0].meta, { pageTitle: "", description: "hello world", keywords: "", siteName: "" });
});

test("analyzeBookmarkProfile saves the snapshot and the report as JSON", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "tidymark-profile-"));
  let prompt;
  const poe = {
    async chat({ messages }) {
      prompt = messages.at(-1).content;
      return { content: JSON.stringify(llmAnswer), model: "Claude-Test" };
    },
  };
  const result = await analyzeBookmarkProfile(poe, { bookmarks }, { model: "Claude-Test", dataDir, now: new Date("2026-09-23T10:00:00Z") });
  assert.match(prompt, /typescriptlang\.org/);
  assert.equal(result.model, "Claude-Test");
  assert.equal(result.coverage.total, 3);
  const snapshot = JSON.parse(await readFile(path.join(dataDir, "snapshots/bookmarks-20260923-100000.json"), "utf8"));
  assert.equal(snapshot.bookmarks[0].meta.description, "Learn TypeScript");
  const latest = JSON.parse(await readFile(path.join(dataDir, "profile-latest.json"), "utf8"));
  assert.equal(latest.folderStructure.rootName, "내 서재");
});

test("createPoeClient calls the OpenAI-compatible endpoint with a bearer key", async () => {
  let call;
  const poe = createPoeClient({
    apiKey: "poe-test",
    fetchImpl: async (url, init) => {
      call = { url, init };
      return new Response(JSON.stringify({ model: "Claude-Test", choices: [{ message: { content: "{}" } }] }));
    },
  });
  const answer = await poe.chat({ model: "Claude-Test", messages: [{ role: "user", content: "hi" }] });
  assert.equal(call.url, "https://api.poe.com/v1/chat/completions");
  assert.equal(call.init.headers.Authorization, "Bearer poe-test");
  assert.equal(JSON.parse(call.init.body).model, "Claude-Test");
  assert.equal(answer.content, "{}");
  assert.throws(() => createPoeClient({ apiKey: "" }), /POE_API_KEY/);
});

test("analyzeBookmarkProfile keeps the snapshot when the LLM call fails", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "tidymark-profile-"));
  const poe = { chat: async () => { throw new Error("Poe down"); } };
  await assert.rejects(analyzeBookmarkProfile(poe, { bookmarks }, { dataDir }), /Poe down.*저장했습니다/);
  const snapshot = JSON.parse(await readFile(path.join(dataDir, "bookmarks-latest.json"), "utf8"));
  assert.equal(snapshot.count, 3);
});

test("metadata cache reuses saved snapshot values and refetches empty or forced ones", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "tidymark-cache-"));
  const file = path.join(dataDir, "bookmarks-latest.json");
  await writeFile(file, JSON.stringify({ bookmarks: [
    { url: "https://saved.example", meta: { description: "저장된 설명" } },
    { url: "https://failed.example", meta: { description: "" } },
  ] }));
  const fetched = [];
  const cache = createMetadataCache(file, {
    fetchMetadata: async (url) => {
      fetched.push(url);
      return { description: "새로 읽음" };
    },
  });
  const input = { bookmarks: [
    { id: "1", title: "Saved", url: "https://saved.example" },
    { id: "2", title: "Failed", url: "https://failed.example" },
    { id: "3", title: "New", url: "https://new.example" },
  ] };
  const first = await enrichBookmarks(input, { cache });
  assert.equal(first.cached, 1);
  assert.equal(first.results[0].meta.description, "저장된 설명");
  assert.deepEqual(fetched, ["https://failed.example", "https://new.example"]);

  const forced = await enrichBookmarks({ ...input, refresh: true }, { cache });
  assert.equal(forced.cached, 0);
  assert.equal(forced.results[0].meta.description, "새로 읽음");
});

test("metadata cache works before any snapshot exists", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "tidymark-cache-"));
  const cache = createMetadataCache(path.join(dataDir, "missing.json"), { fetchMetadata: async () => ({ siteName: "A" }) });
  assert.deepEqual(await cache.fetch("https://a.example"), { meta: { siteName: "A" }, cached: false });
});

test("enrichBookmarks reports each bookmark as soon as it is read", async () => {
  const seen = [];
  const { results } = await enrichBookmarks(
    { bookmarks: [
      { id: "1", title: "Slow", url: "https://slow.example" },
      { id: "2", title: "Fast", url: "https://fast.example" },
    ] },
    {
      metadataFetch: (url) =>
        new Promise((resolve) => setTimeout(() => resolve({ siteName: url }), url.includes("slow") ? 20 : 1)),
      onResult: (result, info) => seen.push([result.id, info.cached]),
    },
  );
  assert.deepEqual(seen, [["2", false], ["1", false]]);
  assert.deepEqual(results.map((result) => result.id), ["1", "2"]);
});

test("createPoeClient reports answers cut off by the token limit", async () => {
  const poe = createPoeClient({
    apiKey: "key",
    fetchImpl: async () => Response.json({ choices: [{ message: { content: "{\"a\":" }, finish_reason: "length" }] }),
  });
  await assert.rejects(poe.chat({ model: "m", messages: [], maxTokens: 10 }), /잘렸습니다/);
});
