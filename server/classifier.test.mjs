import assert from "node:assert/strict";
import test from "node:test";
import { classifyBookmark, MAX_FOLDERS, normalizeRequest } from "./classifier.mjs";

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
