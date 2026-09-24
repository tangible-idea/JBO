import assert from "node:assert/strict";
import test from "node:test";
import {
  chunkItems,
  collectBookmarks,
  groupPlan,
  isBatchMoveEligible,
  mapWithConcurrency,
  parseCategories,
  toPlanItem,
} from "./options-utils.js";

test("parseCategories trims and deduplicates lines", () => {
  assert.deepEqual(parseCategories(" 개발 \n디자인\n개발\n"), ["개발", "디자인"]);
});

test("chunkItems preserves every bookmark", () => {
  assert.deepEqual(chunkItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test("batch moves require a category above the saved threshold", () => {
  assert.equal(isBatchMoveEligible({ category: "개발", confidence: 0.8 }, 0.7), true);
  assert.equal(isBatchMoveEligible({ category: "개발", confidence: 0.7 }, 0.7), false);
  assert.equal(isBatchMoveEligible({ category: null, confidence: 0.99 }, 0.7), false);
});

test("collectBookmarks keeps parent ids and readable paths", () => {
  const bookmarks = collectBookmarks([{ id: "0", title: "", children: [
    { id: "1", title: "북마크바", children: [
      { id: "5", parentId: "1", title: "Docs", url: "https://docs.example.com", dateAdded: 10, dateLastUsed: 20 },
    ] },
  ] }]);
  assert.deepEqual(bookmarks, [
    {
      id: "5",
      parentId: "1",
      title: "Docs",
      url: "https://docs.example.com",
      currentPath: "북마크바",
      dateAdded: 10,
      dateLastUsed: 20,
      unmodifiable: false,
    },
  ]);
});

test("mapWithConcurrency preserves order and caps parallel work", async () => {
  let running = 0;
  let peak = 0;
  const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 1));
    running -= 1;
    return value * 10;
  });
  assert.deepEqual(result, [10, 20, 30, 40, 50]);
  assert.equal(peak, 2);
});

test("toPlanItem pre-selects confident moves that actually change folders", () => {
  const bookmark = { id: "5", parentId: "10" };
  assert.equal(toPlanItem(bookmark, { category: "개발", confidence: 0.9 }, 0.7).checked, true);
  assert.equal(toPlanItem(bookmark, { category: "개발", confidence: 0.6 }, 0.7).needsReview, true);
  const inPlace = toPlanItem(bookmark, { folder: { id: "10" }, confidence: 0.95 }, 0.7);
  assert.equal(inPlace.alreadyThere, true);
  assert.equal(inPlace.checked, false);
  assert.equal(toPlanItem(bookmark, { category: null, confidence: 0.9 }, 0.7).destination, "");
});

test("groupPlan orders groups by size and leaves unassigned last", () => {
  const groups = groupPlan([
    { destination: "" },
    { destination: "category:A" },
    { destination: "category:B" },
    { destination: "category:B" },
  ]);
  assert.deepEqual(groups.map((group) => group.destination), ["category:B", "category:A", ""]);
});
