import assert from "node:assert/strict";
import test from "node:test";
import { chunkItems, isBatchMoveEligible, parseCategories } from "./options-utils.js";

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
