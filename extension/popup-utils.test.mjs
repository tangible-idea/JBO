import assert from "node:assert/strict";
import test from "node:test";
import { shouldSuggestNewFolder, suggestFolderName } from "./popup-utils.js";

test("suggests a new folder at or below the saved confidence threshold", () => {
  assert.equal(shouldSuggestNewFolder({ recommendation: { id: "1" }, confidence: 0.7 }, 0.7), true);
  assert.equal(shouldSuggestNewFolder({ recommendation: { id: "1" }, confidence: 0.69 }, 0.7), true);
  assert.equal(shouldSuggestNewFolder({ recommendation: { id: "1" }, confidence: 0.71 }, 0.7), false);
});

test("suggests a new folder whenever no existing folder matches", () => {
  assert.equal(shouldSuggestNewFolder({ recommendation: null, confidence: 0.99 }, 0.7), true);
});

test("derives an editable folder name from the page hostname", () => {
  assert.equal(suggestFolderName({ url: "https://github.com/typesafe-ai/sdk" }), "GitHub");
  assert.equal(suggestFolderName({ url: "https://docs.typescriptlang.org/handbook" }), "TypeScript");
});
