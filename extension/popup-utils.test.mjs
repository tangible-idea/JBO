import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFolderTree,
  filterFolderTree,
  flattenFolderTree,
  shouldSuggestNewFolder,
  suggestFolderName,
} from "./popup-utils.js";

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

const chromeTree = [
  {
    id: "0",
    title: "",
    children: [
      {
        id: "1",
        title: "북마크바",
        children: [
          { id: "10", title: "Dev", children: [{ id: "11", title: "JavaScript", children: [] }] },
          { id: "20", title: "Example", url: "https://example.com" },
        ],
      },
      { id: "2", title: "기타 북마크", children: [{ id: "30", title: "Reading", children: [] }] },
    ],
  },
];

test("builds a folder-only tree with full paths", () => {
  const tree = buildFolderTree(chromeTree);
  assert.deepEqual(tree.map((folder) => folder.id), ["1", "2"]);
  assert.equal(tree[0].children[0].children[0].path, "북마크바 / Dev / JavaScript");
  assert.equal(tree[0].children.length, 1);
  assert.deepEqual(flattenFolderTree(tree).map((folder) => folder.id), ["1", "10", "11", "2", "30"]);
});

test("filters the tree to matches and their ancestors", () => {
  const filtered = filterFolderTree(buildFolderTree(chromeTree), "java");
  assert.deepEqual(filtered.map((folder) => folder.id), ["1"]);
  assert.equal(filtered[0].matches, false);
  assert.equal(filtered[0].children[0].children[0].matches, true);
  assert.equal(filterFolderTree(buildFolderTree(chromeTree), "없는폴더").length, 0);
});
