import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY,
  findBursts,
  findDuplicates,
  findFolderIssues,
  normalizeUrl,
  toUsagePlanItem,
  usageBucket,
} from "./rules.js";

const now = Date.UTC(2026, 8, 24);
const ago = (days) => now - days * DAY;

test("usageBucket sorts by last use and leaves fresh saves alone", () => {
  assert.equal(usageBucket({ dateAdded: ago(3) }, { now }).bucket, "recent");
  assert.equal(usageBucket({ dateAdded: ago(400), dateLastUsed: ago(5) }, { now }).bucket, "active");
  assert.equal(usageBucket({ dateAdded: ago(400), dateLastUsed: ago(90) }, { now }).bucket, "occasional");
  assert.equal(usageBucket({ dateAdded: ago(400), dateLastUsed: ago(200) }, { now }).bucket, "archive");
  assert.equal(usageBucket({ dateAdded: ago(60) }, { now }).bucket, "someday");
});

test("usageBucket treats pre-tracking bookmarks as unknown until history is checked", () => {
  const old = { dateAdded: Date.UTC(2021, 0, 1) };
  assert.equal(usageBucket(old, { now }).bucket, "unknown");
  assert.equal(usageBucket(old, { now, historyChecked: true }).bucket, "archive");
  assert.equal(usageBucket(old, { now, historyChecked: true, visit: { lastVisitTime: ago(2) } }).bucket, "active");
});

test("findBursts groups saves made close together and skips filed or imported ones", () => {
  const hour = 3_600_000;
  const burst = [0, 1, 2, 3].map((index) => ({ id: `t${index}`, parentId: "inbox", dateAdded: ago(100) + index * hour }));
  const filed = [0, 1, 2, 3].map((index) => ({ id: `f${index}`, parentId: "work", dateAdded: ago(50) + index * hour }));
  const imported = Array.from({ length: 40 }, (_, index) => ({ id: `i${index}`, parentId: "inbox", dateAdded: ago(20) }));
  const lonely = [{ id: "x", parentId: "inbox", dateAdded: ago(10) }];
  const bursts = findBursts([...burst, ...filed, ...imported, ...lonely], { inboxParentIds: new Set(["inbox"]) });
  assert.equal(bursts.length, 1);
  assert.deepEqual(bursts[0].bookmarks.map((bookmark) => bookmark.id), ["t0", "t1", "t2", "t3"]);
});

test("findBursts splits long chains at the widest gap", () => {
  const hour = 3_600_000;
  // Two groups of 4, chained by 10-hour gaps, spanning more than a week in total.
  const times = [0, 1, 2, 3, 200, 201, 202, 203].map((h) => ago(300) + h * hour);
  const bridge = Array.from({ length: 19 }, (_, index) => ago(300) + (3 + (index + 1) * 10) * hour).filter((t) => t < ago(300) + 200 * hour);
  const bookmarks = [...times, ...bridge].map((dateAdded, index) => ({ id: String(index), parentId: "inbox", dateAdded }));
  const bursts = findBursts(bookmarks, { inboxParentIds: new Set(["inbox"]) });
  assert.ok(bursts.length >= 1);
  for (const burst of bursts) assert.ok(burst.endedAt - burst.startedAt <= 7 * DAY);
});

test("normalizeUrl ignores fragments, trailing slashes, www and utm tags", () => {
  assert.equal(normalizeUrl("https://www.example.com/a/#top"), normalizeUrl("https://example.com/a"));
  assert.equal(normalizeUrl("https://example.com/?utm_source=x"), normalizeUrl("https://example.com"));
  assert.notEqual(normalizeUrl("https://example.com/?page=2"), normalizeUrl("https://example.com"));
});

test("findDuplicates keeps the copy filed in a real folder", () => {
  const groups = findDuplicates(
    [
      { id: "1", parentId: "inbox", url: "https://example.com/a", dateAdded: 1 },
      { id: "2", parentId: "work", url: "https://example.com/a/", dateAdded: 2 },
      { id: "3", parentId: "work", url: "https://example.com/b", dateAdded: 3 },
    ],
    { inboxParentIds: new Set(["inbox"]) },
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].keep.id, "2");
  assert.deepEqual(groups[0].remove.map((bookmark) => bookmark.id), ["1"]);
});

test("findFolderIssues finds empty folders and the outermost stale folder", () => {
  const tree = [{ id: "0", title: "", children: [
    { id: "1", title: "Bar", folderType: "bookmarks-bar", children: [
      { id: "10", title: "Empty", children: [] },
      { id: "11", title: "Old", dateGroupModified: ago(500), children: [
        { id: "12", title: "Older", dateGroupModified: ago(600), children: [
          { id: "13", url: "https://a.example", dateLastUsed: ago(400) },
        ] },
      ] },
      { id: "14", title: "Used", dateGroupModified: ago(500), children: [
        { id: "15", url: "https://b.example", dateLastUsed: ago(3) },
      ] },
    ] },
  ] }];
  const { empty, stale } = findFolderIssues(tree, { now, protectedIds: new Set(["1"]) });
  assert.deepEqual(empty.map((folder) => folder.id), ["10"]);
  assert.deepEqual(stale.map((folder) => folder.id), ["11"]);
});

test("toUsagePlanItem nests confident topics and holds back unknown usage", () => {
  const bookmark = { id: "1", parentId: "9" };
  const active = toUsagePlanItem(bookmark, { bucket: "active", reason: "" }, { category: "Design", confidence: 0.9 }, 0.7);
  assert.equal(active.destination, "category:Active / Design");
  assert.equal(active.checked, true);
  const weakTopic = toUsagePlanItem(bookmark, { bucket: "someday", reason: "" }, { category: "Design", confidence: 0.5 }, 0.7);
  assert.equal(weakTopic.destination, "category:Someday");
  const unknown = toUsagePlanItem(bookmark, { bucket: "unknown", reason: "" }, null, 0.7);
  assert.equal(unknown.destination, "category:Archive");
  assert.equal(unknown.checked, false);
  assert.equal(unknown.needsReview, true);
  assert.equal(toUsagePlanItem(bookmark, { bucket: "recent", reason: "" }, null, 0.7).destination, "");
});
