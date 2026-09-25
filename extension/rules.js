import { t } from "./i18n.js";
// Rule-based sorting that needs no AI: usage buckets, save-time bursts and checkups.

export const DAY = 86_400_000;

// Chrome started recording dateLastUsed in version 114 (June 2023). A bookmark
// saved before that and never opened since has no record at all.
export const LAST_USED_TRACKING_SINCE = Date.UTC(2023, 5, 1);

export const USAGE_RULES = { recentDays: 14, activeDays: 30, archiveDays: 180 };

// Folder names created under the Tidymark root.
export const USAGE_FOLDERS = {
  active: "Active",
  occasional: "Occasional",
  someday: "Someday",
  archive: "Archive",
};
export const PROJECTS_FOLDER = "Projects";

export function daysAgoLabel(timestamp, now = Date.now()) {
  const days = Math.floor((now - timestamp) / DAY);
  if (days < 1) return t("오늘");
  if (days < 30) return t("{0}일 전", days);
  if (days < 365) return t("{0}개월 전", Math.floor(days / 30));
  return t("{0}년 전", Math.floor(days / 365));
}

/**
 * Decides which usage bucket a bookmark belongs to.
 * `visit` is the chrome.history item for the URL, when history access was granted.
 * Chrome keeps only ~90 days of history, so a missing visit means "not recently".
 */
export function usageBucket(bookmark, { now = Date.now(), visit, historyChecked = false, rules = USAGE_RULES } = {}) {
  const daysSince = (timestamp) => (now - timestamp) / DAY;
  if (bookmark.dateAdded && daysSince(bookmark.dateAdded) < rules.recentDays) {
    return { bucket: "recent", reason: t("{0} 저장", daysAgoLabel(bookmark.dateAdded, now)) };
  }
  const lastUsed = Math.max(bookmark.dateLastUsed || 0, visit?.lastVisitTime || 0);
  if (lastUsed) {
    const days = daysSince(lastUsed);
    const reason = t("마지막 사용 {0}", daysAgoLabel(lastUsed, now));
    if (days <= rules.activeDays) return { bucket: "active", lastUsed, reason };
    if (days > rules.archiveDays) return { bucket: "archive", lastUsed, reason };
    return { bucket: "occasional", lastUsed, reason };
  }
  const savedBeforeTracking = !bookmark.dateAdded || bookmark.dateAdded < LAST_USED_TRACKING_SINCE;
  if (!savedBeforeTracking) {
    return { bucket: "someday", reason: t("{0} 저장 후 안 열어 봄", daysAgoLabel(bookmark.dateAdded, now)) };
  }
  // Old bookmark with no record: history can settle it, otherwise ask the user.
  if (historyChecked) return { bucket: "archive", reason: t("2023년 이후 사용 기록 없음") };
  return { bucket: "unknown", reason: t("사용 기록 없음 (2023년 이전 저장)") };
}

function splitAtLargestGap(group) {
  let at = 1;
  let largest = -1;
  for (let index = 1; index < group.length; index += 1) {
    const gap = group[index].dateAdded - group[index - 1].dateAdded;
    if (gap > largest) {
      largest = gap;
      at = index;
    }
  }
  return [group.slice(0, at), group.slice(at)];
}

/**
 * Finds bursts of bookmarks saved close together in time: likely one purpose.
 * Bookmarks already filed together in a real folder are skipped, and huge
 * same-second batches (imports) are ignored.
 */
export function findBursts(
  bookmarks,
  { gapHours = 12, minSize = 4, maxSpanDays = 7, maxSize = 40, inboxParentIds = new Set() } = {},
) {
  const sorted = bookmarks.filter((bookmark) => bookmark.dateAdded).sort((a, b) => a.dateAdded - b.dateAdded);
  const groups = [];
  let current = [];
  for (const bookmark of sorted) {
    if (current.length && bookmark.dateAdded - current.at(-1).dateAdded > gapHours * 3_600_000) {
      groups.push(current);
      current = [];
    }
    current.push(bookmark);
  }
  if (current.length) groups.push(current);

  const bursts = [];
  const queue = [...groups];
  while (queue.length) {
    const group = queue.shift();
    if (group.length < minSize) continue;
    const span = group.at(-1).dateAdded - group[0].dateAdded;
    const looksImported = group.length >= 30 && span < 60_000;
    if (looksImported) continue;
    if (span > maxSpanDays * DAY || group.length > maxSize) {
      if (span === 0) continue;
      queue.unshift(...splitAtLargestGap(group));
      continue;
    }
    const parents = new Set(group.map((bookmark) => bookmark.parentId));
    const alreadyFiled = parents.size === 1 && !inboxParentIds.has(group[0].parentId);
    if (!alreadyFiled) bursts.push(group);
  }
  return bursts.map((group, index) => ({
    id: `burst-${index}`,
    startedAt: group[0].dateAdded,
    endedAt: group.at(-1).dateAdded,
    bookmarks: group,
  }));
}

export function monthLabel(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Compares URLs the way a person would: ignoring #fragments, trailing slashes and utm_ tags. */
export function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    }
    url.search = url.searchParams.toString() ? `?${url.searchParams}` : "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(value || "").trim();
  }
}

/**
 * Groups duplicate bookmarks. In each group the one to keep is the one filed in a
 * real folder, then the most recently used, then the oldest.
 */
export function findDuplicates(bookmarks, { inboxParentIds = new Set() } = {}) {
  const byUrl = new Map();
  for (const bookmark of bookmarks) {
    const key = normalizeUrl(bookmark.url);
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(bookmark);
  }
  return [...byUrl.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const ranked = [...group].sort((a, b) =>
        Number(inboxParentIds.has(a.parentId)) - Number(inboxParentIds.has(b.parentId)) ||
        (b.dateLastUsed || 0) - (a.dateLastUsed || 0) ||
        (a.dateAdded || 0) - (b.dateAdded || 0),
      );
      return { keep: ranked[0], remove: ranked.slice(1) };
    });
}

/**
 * Walks the raw chrome.bookmarks tree and reports empty folders and folders
 * nobody has touched or opened for a long time.
 */
export function findFolderIssues(tree, { now = Date.now(), staleDays = 365, unusedDays = 180, protectedIds = new Set() } = {}) {
  const empty = [];
  const stale = [];
  const walk = (node, path) => {
    for (const child of node.children || []) {
      if (child.url) continue;
      const childPath = path ? `${path} / ${child.title}` : child.title;
      walk(child, childPath);
      if (protectedIds.has(child.id) || child.unmodifiable || child.folderType) continue;
      if (!child.children?.length) {
        empty.push({ id: child.id, title: child.title, path: childPath });
        continue;
      }
      const links = collectLinks(child);
      const lastUsed = Math.max(0, ...links.map((link) => link.dateLastUsed || 0));
      const modified = child.dateGroupModified || child.dateAdded || 0;
      const untouched = modified && (now - modified) / DAY > staleDays;
      const unused = !lastUsed || (now - lastUsed) / DAY > unusedDays;
      if (untouched && unused && links.length > 0) {
        stale.push({ id: child.id, title: child.title, path: childPath, count: links.length, modified, lastUsed });
      }
    }
  };
  for (const root of tree) walk(root, "");
  // Moving a stale folder moves its stale subfolders too, so list only the outermost.
  const outermost = stale.filter(
    (folder) => !stale.some((other) => other !== folder && folder.path.startsWith(`${other.path} / `)),
  );
  return { empty, stale: outermost };
}

function collectLinks(node) {
  return (node.children || []).flatMap((child) => (child.url ? [child] : collectLinks(child)));
}

const USAGE_SCORE_LABELS = {
  active: t("자주"),
  occasional: t("가끔"),
  someday: t("안 봄"),
  archive: t("오래됨"),
  unknown: t("모름"),
  recent: t("최근"),
};

/**
 * Turns a usage bucket (plus an optional topic from the classifier) into a plan row.
 * The bucket is a rule, so it is trusted; a weak topic only drops the subfolder.
 */
export function toUsagePlanItem(bookmark, usage, topic, threshold) {
  const base = {
    ...bookmark,
    confidence: 1,
    alreadyThere: false,
    bucket: usage.bucket,
    note: usage.reason,
    scoreLabel: USAGE_SCORE_LABELS[usage.bucket],
  };
  if (usage.bucket === "recent") {
    return { ...base, destination: "", needsReview: false, checked: false, scoreLevel: "same" };
  }
  const folder = USAGE_FOLDERS[usage.bucket === "unknown" ? "archive" : usage.bucket];
  const topicFits = Boolean(topic?.category) && Number(topic.confidence) > Number(threshold);
  const unknown = usage.bucket === "unknown";
  return {
    ...base,
    destination: `category:${folder}${topicFits ? ` / ${topic.category}` : ""}`,
    needsReview: unknown,
    checked: !unknown,
    scoreLevel: unknown ? "low" : "high",
  };
}
