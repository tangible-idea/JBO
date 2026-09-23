import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyBookmark,
  classifyBookmarksBatch,
  MAX_BATCH_BOOKMARKS,
  MAX_FOLDERS,
  normalizeBatchRequest,
  normalizeRequest,
} from "./classifier.mjs";

test("normalizeRequest removes invalid and duplicate folders", () => {
  const result = normalizeRequest({
    page: { title: "TypeScript handbook", url: "https://example.com" },
    folders: [
      { id: "1", path: "Development / TypeScript" },
      { id: "1", path: "Duplicate" },
      { id: "", path: "Invalid" },
    ],
  });
  assert.deepEqual(result.folders, [{ id: "1", path: "Development / TypeScript" }]);
});

test("normalizeRequest caps the number of folders", () => {
  const folders = Array.from({ length: MAX_FOLDERS + 5 }, (_, index) => ({
    id: String(index),
    path: `Folder ${index}`,
  }));
  assert.equal(normalizeRequest({ page: { title: "Page" }, folders }).folders.length, MAX_FOLDERS);
});

test("classifyBookmark maps typed probabilities back to Chrome folder ids", async () => {
  const fakeClient = {
    async systemOne(request) {
      assert.equal(request.questions.destination.type, "choice");
      assert.match(request.questions.destination.criteria.folder_1, /Design/);
      return {
        model: "jev-test",
        answers: {
          destination: {
            type: "choice",
            choice: "folder_1",
            confidence: 0.82,
            probabilities: { folder_0: 0.12, folder_1: 0.8, no_good_match: 0.08 },
          },
        },
      };
    },
  };

  const result = await classifyBookmark(fakeClient, {
    page: { title: "Typography guide", url: "https://example.com/type" },
    folders: [
      { id: "10", path: "Development" },
      { id: "20", path: "Design" },
    ],
  });

  assert.deepEqual(result.recommendation, {
    id: "20",
    path: "Design",
    probability: 0.8,
  });
  assert.equal(result.confidence, 0.82);
  assert.equal(result.candidates[0].id, "20");
});

test("classifyBookmark returns no recommendation for no_good_match", async () => {
  const fakeClient = {
    async systemOne() {
      return {
        model: "jev-test",
        answers: {
          destination: {
            type: "choice",
            choice: "no_good_match",
            confidence: 0.7,
            probabilities: { folder_0: 0.2, no_good_match: 0.8 },
          },
        },
      };
    },
  };
  const result = await classifyBookmark(fakeClient, {
    page: { title: "Unrelated" },
    folders: [{ id: "1", path: "Recipes" }],
  });
  assert.equal(result.recommendation, null);
  assert.equal(result.noGoodMatchProbability, 0.8);
});

test("normalizeBatchRequest deduplicates categories and caps bookmarks", () => {
  const result = normalizeBatchRequest({
    categories: ["개발", "개발", "디자인"],
    bookmarks: Array.from({ length: MAX_BATCH_BOOKMARKS + 2 }, (_, index) => ({
      id: String(index),
      title: `Bookmark ${index}`,
      url: `https://example.com/${index}`,
    })),
  });
  assert.deepEqual(result.categories, ["개발", "디자인"]);
  assert.equal(result.bookmarks.length, MAX_BATCH_BOOKMARKS);
});

test("classifyBookmarksBatch asks one independent Choice per bookmark", async () => {
  const fakeClient = {
    async systemOne(request) {
      assert.equal(Object.keys(request.questions).length, 2);
      assert.match(request.questions.bookmark_1.instructions, /bookmarks\[1\]/);
      assert.deepEqual(request.state.bookmarks[0].meta, { description: "TypeScript reference" });
      return {
        model: "jev-test",
        answers: {
          bookmark_0: {
            type: "choice",
            choice: "category_0",
            confidence: 0.91,
            probabilities: { category_0: 0.9, category_1: 0.08, no_good_match: 0.02 },
          },
          bookmark_1: {
            type: "choice",
            choice: "no_good_match",
            confidence: 0.65,
            probabilities: { category_0: 0.1, category_1: 0.2, no_good_match: 0.7 },
          },
        },
      };
    },
  };
  const result = await classifyBookmarksBatch(fakeClient, {
    categories: ["개발", "디자인"],
    bookmarks: [
      { id: "1", title: "TypeScript docs", url: "https://typescriptlang.org" },
      { id: "2", title: "Unknown", url: "https://example.com" },
    ],
  }, { metadataFetch: async (url) => url.includes("typescript") ? { description: "TypeScript reference" } : {} });
  assert.equal(result.results[0].category, "개발");
  assert.equal(result.results[0].confidence, 0.91);
  assert.equal(result.results[1].category, null);
});

test("classifyBookmarksBatch starts every metadata check before asking JEV", async () => {
  const resolvers = new Map();
  let jevCalled = false;
  const classification = classifyBookmarksBatch({
    async systemOne(request) {
      jevCalled = true;
      assert.deepEqual(request.state.bookmarks.map((bookmark) => bookmark.meta.description), ["first", "second"]);
      return { model: "jev-test", answers: Object.fromEntries([0, 1].map((index) => [
        `bookmark_${index}`,
        { choice: "category_0", confidence: 0.9, probabilities: { category_0: 0.9 } },
      ])) };
    },
  }, {
    categories: ["개발", "디자인"],
    bookmarks: [
      { id: "1", title: "First", url: "https://example.com/first" },
      { id: "2", title: "Second", url: "https://example.com/second" },
    ],
  }, { metadataFetch: (url) => new Promise((resolve) => resolvers.set(url, resolve)) });

  assert.equal(resolvers.size, 2);
  resolvers.get("https://example.com/second")({ description: "second" });
  await Promise.resolve();
  assert.equal(jevCalled, false);
  resolvers.get("https://example.com/first")({ description: "first" });
  await classification;
  assert.equal(jevCalled, true);
});
