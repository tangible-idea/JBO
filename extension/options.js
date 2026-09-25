import { createFolderPicker } from "./folder-picker.js";
import {
  buildCategoryTree,
  chunkItems,
  collectBookmarks,
  groupPlan,
  mapWithConcurrency,
  parseCategories,
  toPlanItem,
} from "./options-utils.js";
import { buildFolderTree, flattenFolderTree } from "./popup-utils.js";
import {
  DAY,
  PROJECTS_FOLDER,
  USAGE_FOLDERS,
  USAGE_RULES,
  daysAgoLabel,
  findBursts,
  findDuplicates,
  findFolderIssues,
  monthLabel,
  normalizeUrl,
  toUsagePlanItem,
  usageBucket,
} from "./rules.js";

const DEFAULT_CATEGORIES = [
  "Dev & Tech",
  "AI & Data",
  "Design",
  "Business & Career",
  "Learning",
  "News & Reading",
  "Shopping",
  "Entertainment",
  "Travel",
  "Finance",
];

const DEFAULT_SETTINGS = {
  endpoint: "http://127.0.0.1:8787",
  autoClassify: true,
  autoSave: false,
  confidenceThreshold: 0.78,
  folderLanguage: "ko",
  batchRootName: "Tidymark",
  batchCategories: DEFAULT_CATEGORIES,
};

// 이름을 바꾸기 전에 만든 정리 폴더. 이미 있으면 새 폴더를 만들지 않고 이어서 씁니다.
const LEGACY_ROOT_NAME = "JEV 정리함";

const MAX_TARGET_FOLDERS = 100;
const BATCH_SIZE = { new: 20, existing: 10 };
const CONCURRENCY = 3;
const HISTORY_DAYS = 90;
const PROJECT_CLUSTERS_PER_REQUEST = 6;
const LINK_BATCH = 25;

const ANALYZE_LABELS = {
  new: "새 폴더 구조로 분석하기",
  existing: "기존 폴더 기준으로 분석하기",
  usage: "쓰임새로 나눠 보기",
  projects: "프로젝트 묶음 찾기",
};

const $ = (selector) => document.querySelector(selector);
const el = {
  analyze: $("#analyze-batch"),
  analyzeLabel: $("#analyze-label"),
  apply: $("#apply-batch"),
  applySummary: $("#apply-summary"),
  autoClassify: $("#auto-classify"),
  autoSave: $("#auto-save"),
  batchProgress: $("#batch-progress"),
  batchStatus: $("#batch-status"),
  cancel: $("#cancel-batch"),
  categoryChips: $("#category-chips"),
  categoryCount: $("#category-count"),
  categoryInput: $("#category-input"),
  confirmDialog: $("#confirm-dialog"),
  confirmText: $("#confirm-text"),
  endpoint: $("#endpoint"),
  endpointStatus: $("#endpoint-status"),
  plan: $("#plan"),
  planGroups: $("#plan-groups"),
  planStats: $("#plan-stats"),
  rootName: $("#batch-root-name"),
  scopeCount: $("#scope-count"),
  serverPill: $("#server-pill"),
  settingsStatus: $("#settings-status"),
  targetCount: $("#target-count"),
  targetSearch: $("#target-search"),
  targetTree: $("#target-tree"),
  threshold: $("#threshold"),
  thresholdValue: $("#threshold-value"),
  undoBanner: $("#undo-banner"),
  undoButton: $("#undo-batch"),
  undoText: $("#undo-text"),
  usageBuckets: $("#usage-buckets"),
  usageTopics: $("#usage-topics"),
  usageTopicsNote: $("#usage-topics-note"),
  historyNote: $("#history-note"),
  grantHistory: $("#grant-history"),
  burstPreview: $("#burst-preview"),
  inboxNote: $("#inbox-note"),
};

let settings = DEFAULT_SETTINGS;
let mode = "new";
let scope = "all";
let categories = [...DEFAULT_CATEGORIES];
let folderTree = [];
const folderById = new Map();
let targetIds = new Set();
let allBookmarks = [];
let plan = null; // { mode, items, destinations: [{ key, label }] }
let filter = "all";
const collapsedGroups = new Set();
let abortController = null;
let serverHealth = null;
let insightController = null;
let lastSnapshot = null; // enriched bookmarks from the latest interest analysis
let lastProfile = null;
let rawTree = [];
let inboxParentIds = new Set(); // Chrome's own root folders: bookmarks directly inside are unsorted
let historyGranted = false;
let visitsByUrl = new Map();
let deadLinks = []; // { id, url, reason } from the last link check
let linkController = null;
let checkupItems = [];

const scopePicker = createFolderPicker($("#scope-picker"), { onChange: updateScopeCount });
const rootParentPicker = createFolderPicker($("#root-parent-picker"), { onChange: renderRootNotes });

function setStatus(target, message, kind = "") {
  target.textContent = message;
  target.className = `${target.className.split(" ").filter((name) => !["success", "error"].includes(name)).join(" ")} ${kind}`.trim();
}

function endpointBase() {
  return settings.endpoint.replace(/\/$/, "");
}

function normalizeEndpoint(value) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new Error("HTTP 또는 HTTPS 주소를 입력하세요.");
  return url.origin + url.pathname.replace(/\/$/, "");
}

async function ensureOriginPermission(urlValue) {
  const url = new URL(urlValue);
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return true;
  const originPattern = `${url.protocol}//${url.hostname}/*`;
  const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
  return alreadyGranted || chrome.permissions.request({ origins: [originPattern] });
}

/* ---------- views ---------- */

function showView(view) {
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.view === view));
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.hidden = section.dataset.view !== view;
  });
  history.replaceState(null, "", `#${view}`);
}

function setMode(nextMode) {
  mode = nextMode;
  document.body.dataset.mode = mode;
  document.querySelectorAll(".mode-card").forEach((card) => {
    card.setAttribute("aria-checked", String(card.dataset.mode === mode));
  });
  document.querySelectorAll("[data-for-mode]").forEach((panel) => {
    panel.hidden = panel.dataset.forMode !== mode;
  });
  el.analyzeLabel.textContent = ANALYZE_LABELS[mode];
  chrome.storage.local.set({ organizeMode: mode });
  renderModePreview();
}

function setScope(nextScope) {
  scope = nextScope;
  document.querySelectorAll("[data-scope]").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.scope === scope));
  });
  $("#scope-picker").hidden = scope !== "folder";
  el.inboxNote.hidden = scope !== "inbox";
  updateScopeCount();
}

function descendantFolderIds(id) {
  const ids = new Set();
  const walk = (node) => {
    ids.add(node.id);
    node.children.forEach(walk);
  };
  const root = folderById.get(id);
  if (root) walk(root);
  return ids;
}

// Bookmarks the user can actually move; managed (admin) bookmarks are left alone.
function movableBookmarks() {
  return allBookmarks.filter((bookmark) => !bookmark.unmodifiable);
}

function scopedBookmarks() {
  const bookmarks = movableBookmarks();
  if (scope === "inbox") return bookmarks.filter((bookmark) => inboxParentIds.has(bookmark.parentId));
  if (scope === "all" || !scopePicker.value) return bookmarks;
  const ids = descendantFolderIds(scopePicker.value);
  return bookmarks.filter((bookmark) => ids.has(bookmark.parentId));
}

function updateScopeCount() {
  const count = scopedBookmarks().length;
  const where = scope === "folder" && scopePicker.selected
    ? `‘${scopePicker.selected.title}’ 안의 `
    : scope === "inbox"
      ? "정리 안 된 "
      : "";
  el.scopeCount.textContent = `${where}북마크 ${count.toLocaleString()}개를 분석해요.`;
  renderModePreview();
}

/* ---------- where new folders go (modes A, C, D) ---------- */

function rootName() {
  return el.rootName.value.trim() || DEFAULT_SETTINGS.batchRootName;
}

function rootFullPath() {
  const parent = folderById.get(rootParentPicker.value)?.path;
  return parent ? `${parent} / ${rootName()}` : rootName();
}

function renderRootNotes() {
  document.querySelectorAll(".root-note").forEach((note) => {
    note.textContent = `‘${rootFullPath()}’ 아래에 폴더를 만들어요. 이름과 위치는 A 방식에서 바꿀 수 있어요.`;
  });
  document.querySelectorAll(".archive-path").forEach((node) => {
    node.textContent = `‘${rootName()} / ${USAGE_FOLDERS.archive}’`;
  });
}

/* ---------- usage buckets (mode C) ---------- */

const BUCKET_INFO = [
  ["active", USAGE_FOLDERS.active, `최근 ${USAGE_RULES.activeDays}일 안에 연 것`],
  ["occasional", USAGE_FOLDERS.occasional, `${USAGE_RULES.activeDays}~${USAGE_RULES.archiveDays}일 전에 연 것`],
  ["someday", USAGE_FOLDERS.someday, "저장만 하고 한 번도 안 연 것"],
  ["archive", USAGE_FOLDERS.archive, `${USAGE_RULES.archiveDays}일 넘게 안 연 것`],
  ["unknown", "기록 없음", "2023년 이전에 저장해 사용 기록이 없는 것 · 검토 후 Archive로"],
  ["recent", "그대로 둠", `최근 ${USAGE_RULES.recentDays}일 안에 저장한 것`],
];

function usageFor(bookmark) {
  return usageBucket(bookmark, {
    visit: visitsByUrl.get(normalizeUrl(bookmark.url)),
    historyChecked: historyGranted,
  });
}

function renderUsagePreview() {
  const counts = {};
  for (const bookmark of scopedBookmarks()) {
    const { bucket } = usageFor(bookmark);
    counts[bucket] = (counts[bucket] || 0) + 1;
  }
  const total = scopedBookmarks().length || 1;
  el.usageBuckets.replaceChildren(
    ...BUCKET_INFO.filter(([bucket]) => bucket !== "unknown" || counts.unknown).map(([bucket, name, rule]) => {
      const item = document.createElement("li");
      item.dataset.bucket = bucket;
      item.style.setProperty("--w", `${Math.round(((counts[bucket] || 0) / total) * 100)}%`);
      const label = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = name;
      const detail = document.createElement("small");
      detail.textContent = rule;
      label.append(title, detail);
      const count = document.createElement("b");
      count.textContent = (counts[bucket] || 0).toLocaleString();
      item.append(label, count);
      return item;
    }),
  );
  el.usageTopicsNote.textContent = el.usageTopics.checked
    ? `A 방식의 카테고리 ${categories.length}개로 한 번 더 나눠요. 끄면 AI 없이 바로 끝나요.`
    : "구간 폴더에만 넣어요. AI를 쓰지 않아 바로 끝나요.";
}

function renderHistoryNote() {
  el.grantHistory.hidden = historyGranted;
  el.historyNote.textContent = historyGranted
    ? `최근 ${HISTORY_DAYS}일 방문 기록 ${visitsByUrl.size.toLocaleString()}건을 함께 봐요. 주소창에 직접 입력해 연 페이지도 ‘사용’으로 쳐요.`
    : "북마크를 눌러 연 기록만으로는 주소창으로 연 경우를 놓쳐요. 권한은 이 기능에만 쓰고 서버로 보내지 않아요.";
}

async function loadVisits() {
  historyGranted = await chrome.permissions.contains({ permissions: ["history"] });
  visitsByUrl = new Map();
  if (!historyGranted) return;
  const items = await chrome.history.search({
    text: "",
    startTime: Date.now() - HISTORY_DAYS * DAY,
    maxResults: 100_000,
  });
  for (const item of items) {
    const key = normalizeUrl(item.url);
    const known = visitsByUrl.get(key);
    if (!known || (item.lastVisitTime || 0) > (known.lastVisitTime || 0)) visitsByUrl.set(key, item);
  }
}

async function grantHistory() {
  const granted = await chrome.permissions.request({ permissions: ["history"] });
  if (!granted) return;
  await loadVisits();
  renderHistoryNote();
  renderUsagePreview();
}

/* ---------- save-time bursts (mode D) ---------- */

function renderBurstPreview() {
  const bursts = findBursts(scopedBookmarks(), { inboxParentIds });
  const bookmarkCount = bursts.reduce((sum, burst) => sum + burst.bookmarks.length, 0);
  const summary = document.createElement("li");
  summary.className = "burst-summary";
  summary.textContent = bursts.length
    ? `후보 ${bursts.length}묶음 · 북마크 ${bookmarkCount.toLocaleString()}개`
    : "몰아서 저장한 묶음이 없어요.";
  const recent = [...bursts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5);
  el.burstPreview.replaceChildren(
    summary,
    ...recent.map((burst) => {
      const item = document.createElement("li");
      const when = document.createElement("strong");
      when.textContent = `${new Date(burst.startedAt).toLocaleDateString("ko-KR")} · ${burst.bookmarks.length}개`;
      const sample = document.createElement("small");
      sample.textContent = burst.bookmarks.slice(0, 3).map((bookmark) => bookmark.title || hostOf(bookmark.url)).join(", ");
      item.append(when, sample);
      return item;
    }),
  );
  $("#projects-poe-warning").hidden = !serverHealth || serverHealth.poeConfigured !== false;
}

function renderModePreview() {
  if (mode === "usage") renderUsagePreview();
  if (mode === "projects") renderBurstPreview();
}

/* ---------- categories (mode A) ---------- */

function saveCategories() {
  chrome.storage.sync.set({ batchCategories: categories });
}

function renderCategories() {
  const renderNodes = (nodes) => {
    const list = document.createElement("ul");
    list.className = "category-folder-list";
    for (const node of nodes) {
      const item = document.createElement("li");
      const row = document.createElement("div");
      row.className = `category-folder-row${node.children.length ? " parent" : ""}`;
      const glyph = document.createElement("span");
      glyph.className = `folder-glyph${node.children.length ? " open" : ""}`;
      glyph.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "category-folder-name";
      name.textContent = node.name;
      const remove = document.createElement("button");
      remove.className = "category-folder-remove";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `${node.path} 폴더${node.children.length ? "와 하위 폴더" : ""} 삭제`);
      remove.addEventListener("click", () => {
        categories = categories.filter((category) => category !== node.path && !category.startsWith(`${node.path} / `));
        renderCategories();
        saveCategories();
      });
      row.append(glyph, name, remove);
      item.append(row);
      if (node.children.length) item.append(renderNodes(node.children));
      list.append(item);
    }
    return list;
  };
  el.categoryChips.replaceChildren(renderNodes(buildCategoryTree(categories)), el.categoryInput);
  el.categoryCount.textContent = `${categories.length}개`;
  renderModePreview();
}

function addCategoriesFromInput() {
  const next = parseCategories([...categories, ...el.categoryInput.value.split(",")].join("\n"));
  el.categoryInput.value = "";
  if (next.length === categories.length) return;
  categories = next;
  renderCategories();
  saveCategories();
}

/* ---------- target folders (mode B) ---------- */

function saveTargets() {
  chrome.storage.local.set({ existingTargetIds: [...targetIds] });
}

function renderTargetTree() {
  const query = el.targetSearch.value.trim().toLocaleLowerCase();
  const matches = (node) =>
    !query || node.title.toLocaleLowerCase().includes(query) || node.children.some(matches);
  const build = (nodes, depth) => {
    const fragment = document.createDocumentFragment();
    for (const node of nodes) {
      if (!matches(node)) continue;
      const item = document.createElement("li");
      item.style.setProperty("--depth", String(depth));
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.folderId = node.id;
      checkbox.checked = targetIds.has(node.id);
      const glyph = document.createElement("span");
      glyph.className = "folder-glyph";
      const title = document.createElement("span");
      title.textContent = node.title;
      label.append(checkbox, glyph, title);
      item.append(label);
      fragment.append(item);
      fragment.append(build(node.children, depth + 1));
    }
    return fragment;
  };
  el.targetTree.replaceChildren(build(folderTree, 0));
  updateTargetCount();
}

function updateTargetCount() {
  const over = targetIds.size > MAX_TARGET_FOLDERS;
  setStatus(
    el.targetCount,
    over
      ? `${targetIds.size}개 선택됨 — 한 번에 ${MAX_TARGET_FOLDERS}개까지 비교할 수 있어요. 조금 줄여 주세요.`
      : `${targetIds.size}개 폴더 중에서 골라요.`,
    over ? "error" : "",
  );
}

/* ---------- analysis ---------- */

function destinationLabel(key) {
  if (!key) return plan?.mode === "usage" ? "그대로 두기" : "분류 보류";
  if (key.startsWith("category:")) return key.slice("category:".length);
  return folderById.get(key.slice("folder:".length))?.path || "삭제된 폴더";
}

// Sends bookmarks to the classifier in parallel batches; resolves to id -> result.
async function classifyInBatches(bookmarks, request, batchSize, signal, onProgress) {
  const batches = chunkItems(bookmarks, batchSize);
  const results = await mapWithConcurrency(batches, CONCURRENCY, async (batch) => {
    const body = await postJson("/api/classify-batch", { ...request, bookmarks: batch }, signal);
    onProgress(batch.length);
    return body.results;
  });
  return new Map(results.flat().map((result) => [result.id, result]));
}

/*
 * Each mode prepares a run: it validates its inputs up front and returns
 * { total, message, destinations, execute(signal, onProgress) -> plan items }.
 */
const prepareRun = {
  new(bookmarks) {
    if (categories.length < 2) throw new Error("카테고리를 두 개 이상 만들어 주세요.");
    return {
      total: bookmarks.length,
      message: `북마크 ${bookmarks.length.toLocaleString()}개의 페이지 정보를 읽는 중…`,
      destinations: categories.map((category) => ({ key: `category:${category}`, label: category })),
      async execute(signal, onProgress) {
        const results = await classifyInBatches(bookmarks, { categories }, BATCH_SIZE.new, signal, onProgress);
        return bookmarks.map((bookmark) => toPlanItem(bookmark, results.get(bookmark.id), settings.confidenceThreshold));
      },
    };
  },

  existing(bookmarks) {
    const targets = [...targetIds]
      .map((id) => folderById.get(id))
      .filter(Boolean)
      .map((folder) => ({ id: folder.id, path: folder.path }));
    if (targets.length === 0) throw new Error("넣을 수 있는 폴더를 하나 이상 체크해 주세요.");
    if (targets.length > MAX_TARGET_FOLDERS) throw new Error(`대상 폴더는 ${MAX_TARGET_FOLDERS}개까지 고를 수 있어요.`);
    return {
      total: bookmarks.length,
      message: `북마크 ${bookmarks.length.toLocaleString()}개의 페이지 정보를 읽는 중…`,
      destinations: targets.map((folder) => ({ key: `folder:${folder.id}`, label: folder.path })),
      async execute(signal, onProgress) {
        const results = await classifyInBatches(bookmarks, { folders: targets }, BATCH_SIZE.existing, signal, onProgress);
        return bookmarks.map((bookmark) => toPlanItem(bookmark, results.get(bookmark.id), settings.confidenceThreshold));
      },
    };
  },

  usage(bookmarks) {
    const useTopics = el.usageTopics.checked;
    if (useTopics && categories.length < 2) throw new Error("주제로 나누려면 A 방식의 카테고리가 두 개 이상 필요해요.");
    const judged = bookmarks.map((bookmark) => ({ bookmark, usage: usageFor(bookmark) }));
    const toClassify = useTopics ? judged.filter(({ usage }) => usage.bucket !== "recent").map(({ bookmark }) => bookmark) : [];
    const destinations = Object.values(USAGE_FOLDERS).flatMap((folder) => [
      { key: `category:${folder}`, label: folder },
      ...(useTopics ? categories.map((category) => ({ key: `category:${folder} / ${category}`, label: `${folder} / ${category}` })) : []),
    ]);
    return {
      total: toClassify.length,
      needsServer: toClassify.length > 0,
      message: `구간을 나눴어요. 북마크 ${toClassify.length.toLocaleString()}개의 주제를 읽는 중…`,
      destinations,
      async execute(signal, onProgress) {
        const results = toClassify.length
          ? await classifyInBatches(toClassify, { categories }, BATCH_SIZE.new, signal, onProgress)
          : new Map();
        return judged.map(({ bookmark, usage }) =>
          toUsagePlanItem(bookmark, usage, results.get(bookmark.id), settings.confidenceThreshold),
        );
      },
    };
  },

  projects(bookmarks) {
    if (serverHealth?.poeConfigured === false) throw new Error("프로젝트 이름을 지으려면 서버에 POE_API_KEY가 필요해요.");
    const bursts = findBursts(bookmarks, { inboxParentIds });
    if (bursts.length === 0) throw new Error("몰아서 저장한 묶음을 찾지 못했어요. 범위를 ‘전체 북마크’로 넓혀 보세요.");
    const total = bursts.reduce((sum, burst) => sum + burst.bookmarks.length, 0);
    const destinations = [];
    return {
      total,
      message: `묶음 ${bursts.length}개를 LLM이 살펴보는 중…`,
      emptyMessage: "같은 목적으로 묶이는 북마크가 없었어요. 지금 정리 상태가 괜찮다는 뜻이에요.",
      destinations,
      async execute(signal, onProgress) {
        const burstById = new Map(bursts.map((burst) => [burst.id, burst]));
        const chunks = chunkItems(bursts, PROJECT_CLUSTERS_PER_REQUEST);
        const answers = await mapWithConcurrency(chunks, 2, async (chunk) => {
          const clusters = chunk.map((burst) => ({
            id: burst.id,
            bookmarks: burst.bookmarks.map(({ id, title, url, currentPath }) => ({ id, title, url, folder: currentPath })),
          }));
          const body = await postJson("/api/projects", { clusters }, signal);
          onProgress(chunk.reduce((sum, burst) => sum + burst.bookmarks.length, 0));
          return body.projects;
        });
        const items = [];
        const usedLabels = new Set();
        for (const project of answers.flat()) {
          const burst = burstById.get(project.clusterId);
          const members = new Map(burst.bookmarks.map((bookmark) => [bookmark.id, bookmark]));
          let label = `${monthLabel(burst.startedAt)} · ${project.name}`;
          for (let n = 2; usedLabels.has(label); n += 1) label = `${monthLabel(burst.startedAt)} · ${project.name} ${n}`;
          usedLabels.add(label);
          const key = `category:${PROJECTS_FOLDER} / ${label}`;
          destinations.push({ key, label: `${PROJECTS_FOLDER} / ${label}` });
          for (const id of project.memberIds) {
            const bookmark = members.get(id);
            if (!bookmark) continue;
            const saved = new Date(bookmark.dateAdded);
            items.push({
              ...bookmark,
              destination: key,
              confidence: 1,
              alreadyThere: false,
              needsReview: false,
              checked: true,
              note: `${saved.toLocaleDateString("ko-KR")} 저장`,
              scoreLabel: `${saved.getMonth() + 1}/${saved.getDate()}`,
              scoreLevel: "high",
            });
          }
        }
        return items;
      },
    };
  },
};

// Target path of a category key, so bookmarks already sitting there are not "moved".
function categoryPath(key) {
  return `${rootFullPath()} / ${key.slice("category:".length)}`;
}

function isAlreadyThere(item, key) {
  if (!key) return false;
  if (key.startsWith("folder:")) return key === `folder:${item.parentId}`;
  return item.currentPath === categoryPath(key);
}

async function analyze() {
  const bookmarks = scopedBookmarks();
  let run;
  try {
    if (bookmarks.length === 0) throw new Error("정리할 북마크가 없어요.");
    if (mode !== "existing" && !el.rootName.value.trim()) throw new Error("정리 폴더 이름을 입력해 주세요.");
    run = prepareRun[mode](bookmarks);
    if (run.needsServer !== false && !(await ensureOriginPermission(settings.endpoint))) {
      throw new Error("백엔드 접근 권한이 필요해요.");
    }
  } catch (error) {
    setStatus(el.batchStatus, error.message, "error");
    return;
  }

  abortController = new AbortController();
  const { signal } = abortController;
  const runMode = mode;
  el.analyze.disabled = true;
  el.cancel.hidden = false;
  el.plan.hidden = true;
  el.batchProgress.style.width = "0%";
  document.body.classList.add("is-analyzing");
  let completed = 0;
  setStatus(el.batchStatus, run.message);
  const onProgress = (count) => {
    completed += count;
    el.batchProgress.style.width = `${Math.round((completed / Math.max(run.total, 1)) * 100)}%`;
    setStatus(el.batchStatus, `${run.total.toLocaleString()}개 중 ${completed.toLocaleString()}개 분석 완료…`);
  };

  try {
    const items = await run.execute(signal, onProgress);
    el.batchProgress.style.width = "100%";
    if (items.length === 0) {
      setStatus(el.batchStatus, run.emptyMessage || "옮길 북마크가 없어요.", "success");
      return;
    }
    for (const item of items) {
      if (item.destination && isAlreadyThere(item, item.destination)) {
        item.alreadyThere = true;
        item.checked = false;
      }
    }
    plan = {
      mode: runMode,
      rootName: rootName(),
      rootParentId: rootParentPicker.value,
      destinations: run.destinations,
      items,
    };
    filter = "all";
    collapsedGroups.clear();
    renderPlan();
    el.plan.hidden = false;
    el.plan.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatus(el.batchStatus, "분석이 끝났어요. 예정표를 확인하고 적용하세요.", "success");
  } catch (error) {
    setStatus(
      el.batchStatus,
      signal.aborted ? "분석을 중지했어요." : error.message || "분석에 실패했어요.",
      signal.aborted ? "" : "error",
    );
  } finally {
    abortController = null;
    el.analyze.disabled = false;
    el.cancel.hidden = true;
    document.body.classList.remove("is-analyzing");
  }
}

/* ---------- plan ---------- */

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconUrl(url) {
  const favicon = new URL(chrome.runtime.getURL("_favicon/"));
  favicon.searchParams.set("pageUrl", url);
  favicon.searchParams.set("size", "32");
  return favicon.toString();
}

function visibleItems() {
  return plan.items.filter((item) => {
    if (filter === "checked") return item.checked;
    if (filter === "review") return item.needsReview;
    if (filter === "unassigned") return !item.destination;
    return true;
  });
}

function renderStats() {
  const items = plan.items;
  const checked = items.filter((item) => item.checked).length;
  const holdLabel = destinationLabel("").replace(/두기$/, "둠");
  const stats = [
    ["분석", items.length],
    ["옮길 항목", checked],
    ["검토 필요", items.filter((item) => item.needsReview).length],
    [holdLabel, items.filter((item) => !item.destination).length],
  ];
  if (plan.mode === "existing") stats.push(["이미 제자리", items.filter((item) => item.alreadyThere).length]);
  el.planStats.replaceChildren(
    ...stats.map(([label, value]) => {
      const stat = document.createElement("span");
      stat.innerHTML = `<b></b><small></small>`;
      stat.querySelector("b").textContent = value.toLocaleString();
      stat.querySelector("small").textContent = label;
      return stat;
    }),
  );
  const destinationCount = new Set(items.filter((item) => item.checked).map((item) => item.destination)).size;
  el.applySummary.textContent = checked
    ? `북마크 ${checked.toLocaleString()}개 → 폴더 ${destinationCount}곳`
    : "옮길 북마크를 선택하세요";
  el.apply.disabled = checked === 0;
  el.apply.textContent = checked ? `${checked.toLocaleString()}개 옮기기` : "적용하기";
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.filter === filter));
  });
  $('[data-filter="unassigned"]').textContent = holdLabel;
}

function destinationSelect(item) {
  const select = document.createElement("select");
  select.className = "dest-select";
  select.dataset.itemId = item.id;
  select.setAttribute("aria-label", `${item.title || item.url} 옮길 곳`);
  const none = new Option(plan.mode === "usage" ? "그대로 두기" : "분류 보류 (그대로 두기)", "");
  select.append(none);
  for (const destination of plan.destinations) {
    select.append(new Option(destination.label, destination.key));
  }
  select.value = item.destination;
  return select;
}

function renderPlan() {
  renderStats();
  const groups = groupPlan(visibleItems());
  el.planGroups.replaceChildren();
  if (groups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "plan-empty";
    empty.textContent = "이 보기에 해당하는 북마크가 없어요.";
    el.planGroups.append(empty);
    return;
  }
  for (const group of groups) {
    const section = document.createElement("section");
    section.className = `plan-group${group.destination ? "" : " unassigned"}`;
    section.dataset.destination = group.destination;
    const collapsed = collapsedGroups.has(group.destination);

    const head = document.createElement("div");
    head.className = "plan-group-head";
    const groupCheck = document.createElement("input");
    groupCheck.type = "checkbox";
    groupCheck.className = "group-check";
    const checkedCount = group.items.filter((item) => item.checked).length;
    groupCheck.checked = checkedCount === group.items.length;
    groupCheck.indeterminate = checkedCount > 0 && checkedCount < group.items.length;
    groupCheck.disabled = !group.destination;
    groupCheck.setAttribute("aria-label", `${destinationLabel(group.destination)} 전체 선택`);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "group-toggle";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    const glyph = document.createElement("span");
    glyph.className = "folder-glyph";
    const name = document.createElement("span");
    name.className = "group-name";
    const folder = folderById.get(group.destination.slice("folder:".length));
    const prefixText = group.destination.startsWith("category:")
      ? plan.rootName
      : folder?.path.slice(0, -folder.title.length).replace(/\s\/\s$/, "");
    if (prefixText) {
      const prefix = document.createElement("small");
      prefix.textContent = `${prefixText} /`;
      name.append(prefix);
    }
    name.append(folder && plan.mode === "existing" ? folder.title : destinationLabel(group.destination));
    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = `${checkedCount}/${group.items.length}`;
    toggle.append(glyph, name, count);
    head.append(groupCheck, toggle);
    section.append(head);

    if (!collapsed) {
      const list = document.createElement("ul");
      list.className = "plan-items";
      for (const item of group.items) {
        const row = document.createElement("li");
        row.className = "plan-item";
        row.classList.toggle("review", item.needsReview);
        row.classList.toggle("muted-row", item.alreadyThere);
        const check = document.createElement("input");
        check.type = "checkbox";
        check.className = "item-check";
        check.dataset.itemId = item.id;
        check.checked = item.checked;
        check.disabled = !item.destination;
        check.setAttribute("aria-label", `${item.title || item.url} 옮기기`);

        const icon = document.createElement("img");
        icon.className = "favicon";
        icon.alt = "";
        icon.loading = "lazy";
        icon.src = faviconUrl(item.url);

        const copy = document.createElement("div");
        copy.className = "plan-copy";
        const title = document.createElement("a");
        title.href = item.url;
        title.target = "_blank";
        title.rel = "noreferrer";
        title.textContent = item.title || item.url;
        const meta = document.createElement("small");
        meta.textContent = [hostOf(item.url), item.note, `지금: ${item.currentPath || "최상위"}`]
          .filter(Boolean)
          .join(" · ");
        copy.append(title, meta);

        const score = document.createElement("span");
        score.className = "score";
        score.dataset.level = item.alreadyThere
          ? "same"
          : item.scoreLevel || (item.confidence > settings.confidenceThreshold ? "high" : "low");
        score.textContent = item.alreadyThere
          ? "제자리"
          : item.scoreLabel || `${Math.round(item.confidence * 100)}%`;

        row.append(check, icon, copy, score, destinationSelect(item));
        list.append(row);
      }
      section.append(list);
    }
    el.planGroups.append(section);
  }
}

function findItem(id) {
  return plan.items.find((item) => item.id === id);
}

async function confirmApply(message) {
  el.confirmText.textContent = message;
  const dialog = el.confirmDialog;
  const form = dialog.querySelector("form");
  dialog.showModal();
  return new Promise((resolve) => {
    const finish = (ok) => {
      form.removeEventListener("submit", onSubmit);
      dialog.removeEventListener("cancel", onCancel);
      resolve(ok);
    };
    const onSubmit = (event) => finish(event.submitter?.value === "ok");
    const onCancel = () => finish(false);
    form.addEventListener("submit", onSubmit);
    dialog.addEventListener("cancel", onCancel);
  });
}

async function findOrCreateFolder(parentId, title) {
  const children = await chrome.bookmarks.getChildren(parentId);
  const existing = children.find(
    (item) => !item.url && item.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
  );
  if (existing) return { folder: existing, created: false };
  return { folder: await chrome.bookmarks.create({ parentId, title }), created: true };
}

async function applyPlan() {
  const selected = plan.items.filter((item) => item.checked && item.destination);
  if (selected.length === 0) return;
  const destinationCount = new Set(selected.map((item) => item.destination)).size;
  const message = plan.mode === "existing"
    ? `북마크 ${selected.length}개를 기존 폴더 ${destinationCount}곳으로 옮겨요.`
    : `북마크 ${selected.length}개를 ‘${plan.rootName}’ 아래 ${destinationCount}개 폴더로 옮겨요.`;
  if (!(await confirmApply(message))) return;

  el.apply.disabled = true;
  const undo = createUndoRecord();
  const undoMoves = undo.moves;
  try {
    const folderIdFor = new Map();
    const categoryKeys = [...new Set(selected.map((item) => item.destination))].filter((key) => key.startsWith("category:"));
    if (categoryKeys.length) {
      const root = await findOrCreateFolder(plan.rootParentId, plan.rootName);
      if (root.created) undo.createdFolderIds.push(root.folder.id);
      for (const key of categoryKeys) {
        // "Active / Design" becomes a nested folder pair under the root.
        folderIdFor.set(key, await ensureFolderPath(root.folder.id, key.slice("category:".length).split(" / "), undo));
      }
    }
    for (const item of selected) {
      if (item.destination.startsWith("folder:")) folderIdFor.set(item.destination, item.destination.slice("folder:".length));
    }

    for (let index = 0; index < selected.length; index += 1) {
      const item = selected[index];
      const [current] = await chrome.bookmarks.get(item.id);
      const parentId = folderIdFor.get(item.destination);
      if (!current || current.parentId === parentId) continue;
      undoMoves.push({ id: item.id, parentId: current.parentId, index: current.index });
      await chrome.bookmarks.move(item.id, { parentId });
      if (index % 10 === 0) setStatus(el.batchStatus, `${selected.length}개 중 ${index + 1}개 옮기는 중…`);
    }
    undo.summary = `북마크 ${undoMoves.length}개를 정리했어요.`;
    await saveUndo(undo);
    plan = null;
    el.plan.hidden = true;
    await loadBookmarks();
    await renderUndoBanner();
    setStatus(el.batchStatus, undo.summary, "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    if (undoMoves.length > 0 || undo.createdFolderIds.length > 0) {
      undo.summary = `북마크 ${undoMoves.length}개를 옮기다 멈췄어요.`;
      await saveUndo(undo);
      await renderUndoBanner();
    }
    el.apply.disabled = false;
    setStatus(el.batchStatus, `${error.message || "정리에 실패했어요."} 옮긴 항목은 되돌릴 수 있어요.`, "error");
  }
}

function timeAgo(timestamp) {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

async function ensureFolderPath(parentId, titles, undo) {
  for (const title of titles) {
    const result = await findOrCreateFolder(parentId, title);
    if (result.created) undo.createdFolderIds.push(result.folder.id);
    parentId = result.folder.id;
  }
  return parentId;
}

// One undo record covers moves, created folders and deletions (checkup).
function createUndoRecord() {
  return { moves: [], createdFolderIds: [], removed: [], removedFolders: [], summary: "", createdAt: Date.now() };
}

function saveUndo(undo) {
  return chrome.storage.local.set({ lastBatchUndo: { ...undo, createdAt: Date.now() } });
}

function undoCount(undo) {
  return (undo?.moves?.length || 0) + (undo?.removed?.length || 0) + (undo?.removedFolders?.length || 0);
}

async function renderUndoBanner() {
  const { lastBatchUndo } = await chrome.storage.local.get("lastBatchUndo");
  const count = undoCount(lastBatchUndo);
  el.undoBanner.hidden = count === 0;
  if (count) {
    el.undoText.textContent = `${timeAgo(lastBatchUndo.createdAt)} ${lastBatchUndo.summary || `북마크 ${count}개를 정리했어요.`}`;
  }
}

async function recreate(node) {
  const { title, url, parentId, index } = node;
  try {
    return await chrome.bookmarks.create({ parentId, index, title, ...(url ? { url } : {}) });
  } catch {
    // The index may no longer exist; fall back to the end of the folder.
    return chrome.bookmarks.create({ parentId, title, ...(url ? { url } : {}) });
  }
}

async function undoLastBatch() {
  const { lastBatchUndo } = await chrome.storage.local.get("lastBatchUndo");
  const total = undoCount(lastBatchUndo);
  if (total === 0) return;
  el.undoButton.disabled = true;
  let restored = 0;
  for (const move of [...(lastBatchUndo.moves || [])].reverse()) {
    try {
      await chrome.bookmarks.move(move.id, { parentId: move.parentId, index: move.index });
      restored += 1;
    } catch {
      // Continue restoring the remaining bookmarks if one parent was deleted.
    }
  }
  const byIndex = (a, b) => a.index - b.index;
  for (const node of [...(lastBatchUndo.removedFolders || []), ...(lastBatchUndo.removed || [])].sort(byIndex)) {
    try {
      await recreate(node);
      restored += 1;
    } catch {
      // The parent folder may be gone; skip this one.
    }
  }
  for (const folderId of [...(lastBatchUndo.createdFolderIds || [])].reverse()) {
    try {
      const children = await chrome.bookmarks.getChildren(folderId);
      if (children.length === 0) await chrome.bookmarks.remove(folderId);
    } catch {
      // The folder may already have been removed or may now contain user data.
    }
  }
  await chrome.storage.local.remove("lastBatchUndo");
  el.undoButton.disabled = false;
  await loadBookmarks();
  await renderUndoBanner();
  const message = `${restored}개 항목을 원래대로 되돌렸어요.`;
  const kind = restored === total ? "success" : "error";
  setStatus(el.batchStatus, message, kind);
  setStatus($("#links-status"), message, kind);
}

/* ---------- checkup (F) ---------- */

const CHECKUP_KINDS = [
  ["dead", "끊긴 링크", "#dead-list"],
  ["duplicate", "중복", "#duplicate-list"],
  ["empty", "빈 폴더", "#empty-list"],
  ["stale", "방치된 폴더", "#stale-list"],
];
const ACTION_LABELS = { remove: "삭제", removeFolder: "삭제", archive: "보관" };
let deadCheckedAt = 0;
let staleDays = 365;

function buildCheckupItems() {
  const wasChecked = new Map(checkupItems.map((item) => [item.key, item.checked]));
  const byId = new Map(movableBookmarks().map((bookmark) => [bookmark.id, bookmark]));
  const items = [];
  const deadIds = new Set();
  for (const link of deadLinks) {
    const bookmark = byId.get(link.id);
    if (!bookmark) continue;
    deadIds.add(bookmark.id);
    items.push({
      key: `dead:${bookmark.id}`,
      kind: "dead",
      action: "remove",
      id: bookmark.id,
      title: bookmark.title || bookmark.url,
      url: bookmark.url,
      detail: `${link.reason} · ${bookmark.currentPath || "최상위"}`,
      checked: true,
    });
  }
  for (const group of findDuplicates(movableBookmarks(), { inboxParentIds })) {
    for (const bookmark of group.remove) {
      if (deadIds.has(bookmark.id)) continue;
      items.push({
        key: `duplicate:${bookmark.id}`,
        kind: "duplicate",
        action: "remove",
        id: bookmark.id,
        title: bookmark.title || bookmark.url,
        url: bookmark.url,
        detail: `${bookmark.currentPath || "최상위"}에서 삭제 · 남는 곳: ${group.keep.currentPath || "최상위"}`,
        checked: true,
      });
    }
  }
  const archiveRoot = rootFullPath();
  // A folder counts as stale when it was neither changed nor opened for the chosen period.
  const { empty, stale } = findFolderIssues(rawTree, {
    staleDays,
    unusedDays: staleDays,
    protectedIds: new Set(folderTree.map((folder) => folder.id)),
  });
  for (const folder of empty) {
    items.push({
      key: `empty:${folder.id}`,
      kind: "empty",
      action: "removeFolder",
      id: folder.id,
      title: folder.title || "(이름 없음)",
      detail: folder.path,
      checked: true,
    });
  }
  for (const folder of stale) {
    if (folder.path === archiveRoot || folder.path.startsWith(`${archiveRoot} / `)) continue;
    items.push({
      key: `stale:${folder.id}`,
      kind: "stale",
      action: "archive",
      id: folder.id,
      title: folder.title,
      detail: [
        folder.path,
        `북마크 ${folder.count}개`,
        `마지막 변경 ${daysAgoLabel(folder.modified)}`,
        folder.lastUsed ? `마지막 사용 ${daysAgoLabel(folder.lastUsed)}` : "연 기록 없음",
      ].join(" · "),
      checked: false,
    });
  }
  for (const item of items) if (wasChecked.has(item.key)) item.checked = wasChecked.get(item.key);
  checkupItems = items;
  renderCheckup();
}

function checkupRow(item) {
  const row = document.createElement("li");
  row.className = "checkup-item";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.dataset.key = item.key;
  check.checked = item.checked;
  check.setAttribute("aria-label", `${item.title} ${ACTION_LABELS[item.action]}`);
  let icon;
  if (item.url) {
    icon = document.createElement("img");
    icon.className = "favicon";
    icon.alt = "";
    icon.loading = "lazy";
    icon.src = faviconUrl(item.url);
  } else {
    icon = document.createElement("span");
    icon.className = "folder-glyph";
  }
  const copy = document.createElement("div");
  copy.className = "plan-copy";
  const title = document.createElement(item.url ? "a" : "strong");
  title.textContent = item.title;
  if (item.url) {
    title.href = item.url;
    title.target = "_blank";
    title.rel = "noreferrer";
  }
  const detail = document.createElement("small");
  detail.textContent = item.detail;
  detail.title = item.detail;
  copy.append(title, detail);
  const tag = document.createElement("span");
  tag.className = "action-tag";
  tag.dataset.action = item.action;
  tag.textContent = ACTION_LABELS[item.action];
  row.append(check, icon, copy, tag);
  return row;
}

function emptyRow(text) {
  const row = document.createElement("li");
  row.className = "checkup-empty";
  row.textContent = text;
  return row;
}

function renderCheckup() {
  const stats = $("#checkup-stats");
  stats.replaceChildren(
    ...CHECKUP_KINDS.map(([kind, label]) => {
      const count = checkupItems.filter((item) => item.kind === kind).length;
      const stat = document.createElement("button");
      stat.type = "button";
      stat.dataset.kind = kind;
      const value = document.createElement("b");
      value.textContent = kind === "dead" && !deadCheckedAt ? "–" : count.toLocaleString();
      const name = document.createElement("small");
      name.textContent = kind === "dead" && !deadCheckedAt ? `${label} · 확인 전` : label;
      stat.append(value, name);
      stat.classList.toggle("has-items", count > 0);
      return stat;
    }),
  );
  for (const [kind, , selector] of CHECKUP_KINDS) {
    const items = checkupItems.filter((item) => item.kind === kind);
    const list = $(selector);
    if (items.length) {
      list.replaceChildren(...items.map(checkupRow));
    } else if (kind === "dead" && !deadCheckedAt) {
      list.replaceChildren(emptyRow("‘링크 확인하기’를 누르면 모든 북마크 주소에 접속해 봐요. 북마크가 많으면 몇 분 걸려요."));
    } else {
      list.replaceChildren(emptyRow(kind === "dead" ? "끊긴 링크가 없어요." : "찾은 항목이 없어요."));
    }
  }
  if (deadCheckedAt) {
    $("#check-links").textContent = "다시 확인하기";
  }
  renderStaleControls();
  renderCheckupSummary();
}

function renderStaleControls() {
  const select = $("#stale-period");
  select.value = String(staleDays);
  $("#stale-period-label").textContent = select.selectedOptions[0]?.textContent || "";
  const stale = checkupItems.filter((item) => item.kind === "stale");
  const allChecked = stale.length > 0 && stale.every((item) => item.checked);
  const toggle = $("#stale-toggle-all");
  toggle.hidden = stale.length === 0;
  toggle.textContent = allChecked ? "전체 해제" : `전체 선택 (${stale.length})`;
}

function renderCheckupSummary() {
  const selected = checkupItems.filter((item) => item.checked);
  const removeCount = selected.filter((item) => item.action === "remove").length;
  const folderCount = selected.filter((item) => item.action === "removeFolder").length;
  const archiveCount = selected.filter((item) => item.action === "archive").length;
  const parts = [
    removeCount && `북마크 ${removeCount}개 삭제`,
    folderCount && `빈 폴더 ${folderCount}개 삭제`,
    archiveCount && `폴더 ${archiveCount}개 보관`,
  ].filter(Boolean);
  $("#checkup-summary").textContent = parts.length ? parts.join(" · ") : "처리할 항목을 선택하세요";
  const apply = $("#apply-checkup");
  apply.disabled = selected.length === 0;
  apply.textContent = selected.length ? `${selected.length}개 처리하기` : "적용하기";
  return parts.join(", ");
}

async function checkDeadLinks() {
  const status = $("#links-status");
  const progress = $("#links-progress");
  const targets = movableBookmarks().filter((bookmark) => /^https?:/i.test(bookmark.url));
  if (targets.length === 0) {
    setStatus(status, "확인할 웹 주소가 없어요.", "error");
    return;
  }
  if (!(await ensureOriginPermission(settings.endpoint))) {
    setStatus(status, "백엔드 접근 권한이 필요해요.", "error");
    return;
  }
  linkController = new AbortController();
  const { signal } = linkController;
  const button = $("#check-links");
  const cancel = $("#cancel-links");
  button.disabled = true;
  cancel.hidden = false;
  progress.style.width = "0%";
  document.body.classList.add("is-analyzing");
  const found = [];
  let done = 0;
  let finished = false;
  try {
    await mapWithConcurrency(chunkItems(targets, LINK_BATCH), CONCURRENCY, async (chunk) => {
      const body = await postJson("/api/check-links", { bookmarks: chunk.map(({ id, url }) => ({ id, url })) }, signal);
      for (const result of body.results) {
        if (result.state === "dead") found.push({ id: result.id, url: result.url, reason: result.reason });
      }
      done += chunk.length;
      progress.style.width = `${Math.round((done / targets.length) * 100)}%`;
      setStatus(status, `${targets.length.toLocaleString()}개 중 ${done.toLocaleString()}개 확인 · 끊긴 링크 ${found.length}개`);
    });
    finished = true;
    setStatus(status, `다 확인했어요. 끊긴 링크 ${found.length}개를 찾았어요.`, "success");
  } catch (error) {
    setStatus(status, signal.aborted ? `중지했어요. 확인한 ${done.toLocaleString()}개 중 끊긴 링크 ${found.length}개를 보여 줘요.` : error.message, signal.aborted ? "" : "error");
  } finally {
    linkController = null;
    button.disabled = false;
    cancel.hidden = true;
    document.body.classList.remove("is-analyzing");
  }
  if (finished || found.length) {
    deadLinks = found;
    deadCheckedAt = Date.now();
    await chrome.storage.local.set({ deadLinks: { checkedAt: deadCheckedAt, results: found } });
    buildCheckupItems();
  }
}

async function nodeById(id) {
  try {
    return (await chrome.bookmarks.get(id))[0] || null;
  } catch {
    return null;
  }
}

async function applyCheckup() {
  const selected = checkupItems.filter((item) => item.checked);
  if (selected.length === 0) return;
  const summary = renderCheckupSummary();
  if (!(await confirmApply(`${summary}할게요.`))) return;

  const status = $("#links-status");
  const apply = $("#apply-checkup");
  apply.disabled = true;
  const undo = createUndoRecord();
  let archiveId = null;
  let processed = 0;
  try {
    for (const item of selected) {
      const node = await nodeById(item.id);
      if (!node) continue;
      if (item.action === "remove") {
        undo.removed.push({ title: node.title, url: node.url, parentId: node.parentId, index: node.index });
        await chrome.bookmarks.remove(node.id);
      } else if (item.action === "removeFolder") {
        if ((await chrome.bookmarks.getChildren(node.id)).length) continue;
        undo.removedFolders.push({ title: node.title, parentId: node.parentId, index: node.index });
        await chrome.bookmarks.remove(node.id);
      } else if (item.action === "archive") {
        if (!archiveId) {
          const root = await findOrCreateFolder(rootParentPicker.value, rootName());
          if (root.created) undo.createdFolderIds.push(root.folder.id);
          archiveId = await ensureFolderPath(root.folder.id, [USAGE_FOLDERS.archive], undo);
        }
        if (node.parentId === archiveId) continue;
        undo.moves.push({ id: node.id, parentId: node.parentId, index: node.index });
        await chrome.bookmarks.move(node.id, { parentId: archiveId });
      }
      processed += 1;
    }
    undo.summary = `점검 항목 ${processed}개를 처리했어요.`;
    setStatus(status, undo.summary, "success");
  } catch (error) {
    undo.summary = `점검 항목 ${processed}개를 처리하다 멈췄어요.`;
    setStatus(status, `${error.message || "처리에 실패했어요."} 처리한 항목은 되돌릴 수 있어요.`, "error");
  }
  if (undoCount(undo) > 0) await saveUndo(undo);
  const removedIds = new Set(selected.filter((item) => item.action === "remove").map((item) => item.id));
  deadLinks = deadLinks.filter((link) => !removedIds.has(link.id));
  await chrome.storage.local.set({ deadLinks: { checkedAt: deadCheckedAt, results: deadLinks } });
  await loadBookmarks();
  await renderUndoBanner();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- interests (Poe LLM) ---------- */

function renderPoeWarning() {
  $("#poe-warning").hidden = !serverHealth || serverHealth.poeConfigured !== false;
}

function setInsightStep(step) {
  const order = ["meta", "save", "llm"];
  document.querySelectorAll("#insight-steps li").forEach((item) => {
    const index = order.indexOf(item.dataset.step);
    const current = order.indexOf(step);
    item.dataset.state = step === "done" || index < current ? "done" : index === current ? "active" : "";
  });
}

async function postJson(pathname, body, signal) {
  const response = await fetch(`${endpointBase()}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `서버 오류 (${response.status})`);
  return result;
}

const FEED_LOG_SIZE = 7;
const FEED_NOW_SIZE = 4;

function hasMetaValues(meta) {
  return Object.values(meta || {}).some((value) => value);
}

// Live view of the metadata step: what is being read now and what just finished.
function createReadFeed() {
  const root = $("#read-feed");
  const nowHosts = $("#read-now");
  const log = $("#read-log");
  const counts = { fetched: $("#count-fetched"), cached: $("#count-cached"), empty: $("#count-empty") };
  const rate = $("#read-rate");
  const pending = new Map();
  let recent = [];
  let tally = { fetched: 0, cached: 0, empty: 0 };
  let total = 0;
  let startedAt = 0;
  let frame = 0;

  function renderNow() {
    const hosts = [...pending.values()].slice(0, FEED_NOW_SIZE);
    nowHosts.replaceChildren(
      ...hosts.map((bookmark) => {
        const chip = document.createElement("span");
        const icon = document.createElement("img");
        icon.src = faviconUrl(bookmark.url);
        icon.alt = "";
        icon.onerror = () => icon.remove();
        chip.append(icon, hostOf(bookmark.url));
        return chip;
      }),
    );
    const rest = pending.size - hosts.length;
    if (rest > 0) nowHosts.append(Object.assign(document.createElement("em"), { textContent: `외 ${rest}개` }));
  }

  function renderLog() {
    const existing = new Set([...log.children].map((item) => item.dataset.id));
    log.replaceChildren(
      ...recent.map(({ result, kind }) => {
        const item = document.createElement("li");
        item.dataset.id = result.id;
        if (!existing.has(result.id)) item.classList.add("fresh");
        const icon = document.createElement("img");
        icon.className = "favicon";
        icon.src = faviconUrl(result.url);
        icon.alt = "";
        icon.onerror = () => {
          icon.style.visibility = "hidden";
        };
        const copy = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = result.meta.pageTitle || result.title || result.url;
        const detail = document.createElement("small");
        detail.textContent = result.meta.description || result.meta.siteName || hostOf(result.url);
        copy.append(title, detail);
        const badge = document.createElement("span");
        badge.className = `read-badge ${kind}`;
        badge.textContent = { fetched: "읽음", cached: "재사용", empty: "정보 없음" }[kind];
        item.append(icon, copy, badge);
        return item;
      }),
    );
  }

  function renderCounts() {
    for (const [key, node] of Object.entries(counts)) node.textContent = tally[key].toLocaleString();
    const done = tally.fetched + tally.cached + tally.empty;
    const seconds = (performance.now() - startedAt) / 1000;
    if (done > 0 && seconds > 1 && done < total) {
      const perSecond = done / seconds;
      const left = Math.ceil((total - done) / perSecond);
      rate.textContent = `초당 ${perSecond.toFixed(1)}개 · 약 ${left < 60 ? `${left}초` : `${Math.ceil(left / 60)}분`} 남음`;
    } else if (done >= total) {
      rate.textContent = `${seconds.toFixed(0)}초 걸림`;
    }
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderNow();
      renderLog();
      renderCounts();
    });
  }

  return {
    start(count) {
      total = count;
      startedAt = performance.now();
      pending.clear();
      recent = [];
      tally = { fetched: 0, cached: 0, empty: 0 };
      log.replaceChildren();
      rate.textContent = "";
      root.hidden = false;
      root.classList.remove("finished");
      schedule();
    },
    begin(bookmarks) {
      for (const bookmark of bookmarks) pending.set(bookmark.id, bookmark);
      schedule();
    },
    add(result, cached) {
      pending.delete(result.id);
      const kind = cached ? "cached" : hasMetaValues(result.meta) ? "fetched" : "empty";
      tally[kind] += 1;
      recent = [{ result, kind }, ...recent].slice(0, FEED_LOG_SIZE);
      schedule();
    },
    finish() {
      pending.clear();
      root.classList.add("finished");
      schedule();
    },
  };
}

// Reads /api/metadata as NDJSON so each page shows up as soon as it is read.
async function streamMetadata(bookmarks, refresh, signal, onItem) {
  const response = await fetch(`${endpointBase()}/api/metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookmarks, refresh, stream: true }),
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `서버 오류 (${response.status})`);
  }
  if (!response.headers.get("content-type")?.includes("ndjson")) {
    // Older server without streaming: report the whole chunk at once.
    const { results } = await response.json();
    results.forEach((result) => onItem(result, false));
    return results;
  }
  const results = [];
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      if (message.type === "error") throw new Error(message.error);
      if (message.type === "item") {
        results.push(message.result);
        onItem(message.result, message.cached);
      }
    }
    if (done) break;
  }
  return results;
}

async function analyzeInterests() {
  const status = $("#insight-status");
  const progress = $("#insight-progress");
  const button = $("#analyze-interests");
  const cancel = $("#cancel-interests");
  const folderLanguage = $("#folder-language").value;
  if (allBookmarks.length < 3) {
    setStatus(status, "분석하려면 북마크가 3개 이상 필요해요.", "error");
    return;
  }
  insightController = new AbortController();
  const { signal } = insightController;
  const feed = createReadFeed();
  button.disabled = true;
  $("#folder-language").disabled = true;
  cancel.hidden = false;
  progress.style.width = "0%";
  document.body.classList.add("is-analyzing");
  try {
    if (!(await ensureOriginPermission(settings.endpoint))) throw new Error("백엔드 접근 권한이 필요해요.");
    setInsightStep("meta");
    const total = allBookmarks.length;
    const refresh = $("#refresh-meta").checked;
    let done = 0;
    let reused = 0;
    const chunks = chunkItems(
      allBookmarks.map(({ id, title, url, currentPath }) => ({ id, title, url, folder: currentPath })),
      25,
    );
    feed.start(total);
    const enriched = await mapWithConcurrency(chunks, 4, (chunk) => {
      feed.begin(chunk);
      return streamMetadata(chunk, refresh, signal, (result, cached) => {
        done += 1;
        if (cached) reused += 1;
        feed.add(result, cached);
        progress.style.width = `${Math.round((done / total) * 80)}%`;
        setStatus(status, `페이지 메타정보 ${done.toLocaleString()} / ${total.toLocaleString()}`);
      });
    });
    feed.finish();
    lastSnapshot = enriched.flat();

    setInsightStep("llm");
    progress.style.width = "90%";
    setStatus(status, `${serverHealth?.poeModel || "LLM"}이 관심사를 읽는 중… 1~2분 걸릴 수 있어요.`);
    lastProfile = await postJson("/api/profile", { bookmarks: lastSnapshot, folderLanguage }, signal);
    await chrome.storage.local.set({ lastProfile });
    setInsightStep("done");
    progress.style.width = "100%";
    renderProfile(lastProfile);
    setStatus(
      status,
      reused
        ? `분석이 끝났어요. 메타정보 ${reused.toLocaleString()}개는 저장된 JSON을 재사용했어요.`
        : "분석이 끝났어요.",
      "success",
    );
  } catch (error) {
    setInsightStep("");
    setStatus(status, signal.aborted ? "분석을 중지했어요." : error.message, signal.aborted ? "" : "error");
  } finally {
    feed.finish();
    insightController = null;
    button.disabled = false;
    $("#folder-language").disabled = false;
    cancel.hidden = true;
    document.body.classList.remove("is-analyzing");
  }
}

function renderProfile(profile) {
  $("#insight-result").classList.remove("is-empty");
  $("#folder-language").value = profile.folderLanguage === "en" ? "en" : "ko";
  $("#insight-summary-text").textContent = profile.summary || "요약이 없어요.";
  const created = new Date(profile.createdAt);
  const coverage = profile.coverage?.included < profile.coverage?.total
    ? `북마크 ${profile.coverage.total}개 중 ${profile.coverage.included}개 반영`
    : `북마크 ${profile.coverage?.total ?? "?"}개 반영`;
  $("#insight-meta").textContent = [
    `${created.toLocaleString("ko-KR")} · ${profile.model}`,
    coverage,
    profile.snapshotFile ? `저장: ${profile.snapshotFile}` : "",
  ].filter(Boolean).join(" · ");

  const list = $("#interest-list");
  list.replaceChildren();
  $("#interest-count").textContent = `${profile.interests.length}개 주제`;
  profile.interests.forEach((interest, index) => {
    const item = document.createElement("li");
    item.style.setProperty("--w", `${interest.weight}%`);
    item.style.animationDelay = `${index * 50}ms`;
    const rank = document.createElement("span");
    rank.className = "interest-rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    rank.setAttribute("aria-label", `${index + 1}위`);
    const content = document.createElement("div");
    content.className = "interest-content";
    const head = document.createElement("div");
    head.className = "interest-head";
    const name = document.createElement("strong");
    name.textContent = interest.name;
    const weight = document.createElement("span");
    weight.className = "interest-score";
    weight.innerHTML = `<small>관심도</small><b>${interest.weight}</b><em>/100</em>`;
    weight.setAttribute("aria-label", `관심도 ${interest.weight}점`);
    head.append(name, weight);
    const bar = document.createElement("div");
    bar.className = "interest-bar";
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-label", `${interest.name} 관심도`);
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(interest.weight));
    const description = document.createElement("p");
    description.className = "interest-description";
    description.textContent = interest.description;
    const evidenceDisclosure = document.createElement("details");
    evidenceDisclosure.className = "evidence-disclosure";
    const evidenceSummary = document.createElement("summary");
    evidenceSummary.textContent = `근거 북마크 ${interest.evidence.length}개`;
    const evidence = document.createElement("div");
    evidence.className = "evidence";
    if (interest.evidence.length) {
      evidenceDisclosure.append(evidenceSummary);
    }
    for (const example of interest.evidence) {
      const chip = document.createElement("span");
      chip.textContent = example;
      evidence.append(chip);
    }
    content.append(head, bar, description);
    if (interest.evidence.length) {
      evidenceDisclosure.append(evidence);
      content.append(evidenceDisclosure);
    }
    item.append(rank, content);
    list.append(item);
  });

  renderFolderStructure(profile);
}

function renderFolderStructure(profile) {
  const structure = profile.folderStructure;
  const tree = $("#structure-tree");
  const rootLine = document.createElement("p");
  rootLine.className = "structure-root";
  rootLine.innerHTML = '<span class="folder-glyph open"></span>';
  rootLine.append(structure.rootName);
  const categoriesList = document.createElement("ul");
  const createFolderInfo = (folderName, description) => {
    const info = document.createElement("button");
    info.className = "folder-info";
    info.type = "button";
    info.textContent = "i";
    const detail = description || "관련 자료 설명이 없어요.";
    info.dataset.tooltip = detail;
    info.setAttribute("aria-label", `${folderName} 관련 자료: ${detail}`);
    return info;
  };
  for (const category of structure.categories) {
    const item = document.createElement("li");
    const label = document.createElement("div");
    label.className = "structure-node";
    label.innerHTML = '<span class="folder-glyph"></span>';
    const name = document.createElement("strong");
    name.textContent = category.name;
    label.append(name);
    const categoryInfo = createFolderInfo(category.name, category.description);
    label.append(categoryInfo);
    item.append(label);
    if (category.children.length) {
      const children = document.createElement("ul");
      for (const child of category.children) {
        const childItem = document.createElement("li");
        childItem.className = "structure-node child";
        childItem.innerHTML = '<span class="folder-glyph"></span>';
        const childName = document.createElement("span");
        childName.textContent = child.name;
        childItem.append(childName);
        children.append(childItem);
      }
      item.append(children);
    }
    categoriesList.append(item);
  }
  tree.replaceChildren(rootLine, categoriesList);
  $("#structure-count").textContent = `폴더 ${profile.leafCategories.length}개`;
}

async function useProfileStructure({ analyzeNow = false } = {}) {
  if (!lastProfile) return;
  categories = parseCategories(lastProfile.leafCategories.join("\n"));
  const suggestedRoot = lastProfile.folderStructure.rootName;
  el.rootName.value = /^(북마크|bookmarks?)$/i.test(suggestedRoot.trim()) ? "Tidymark" : suggestedRoot;
  chrome.storage.sync.set({ batchRootName: el.rootName.value });
  renderCategories();
  saveCategories();
  setMode("new");
  showView("organize");
  if (analyzeNow) {
    el.analyze.scrollIntoView({ behavior: "smooth", block: "center" });
    await analyze();
  } else {
    setStatus(el.batchStatus, `추천 폴더 ${categories.length}개를 가져왔어요. 분석하면 이동 예정표가 만들어져요.`, "success");
  }
}

function downloadSnapshot() {
  const data = {
    exportedAt: new Date().toISOString(),
    profile: lastProfile,
    bookmarks: lastSnapshot || undefined,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `bookmark-profile-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

async function loadLatestProfile() {
  const local = await chrome.storage.local.get("lastProfile");
  lastProfile = local.lastProfile || null;
  if (!lastProfile) {
    try {
      const response = await fetch(`${endpointBase()}/api/profile/latest`);
      if (response.ok) lastProfile = await response.json();
    } catch {
      // The server may be offline; the view simply starts empty.
    }
  }
  if (lastProfile?.folderStructure) renderProfile(lastProfile);
}

async function changeFolderLanguage(event) {
  const select = event.target;
  const target = select.value;
  const status = $("#structure-language-status");
  status.hidden = true;
  if (!lastProfile?.folderStructure) {
    settings.folderLanguage = target;
    await chrome.storage.sync.set({ folderLanguage: target });
    return;
  }
  const current = lastProfile.folderLanguage === "en" ? "en" : "ko";
  if (target === current) return;
  const variants = {
    ...lastProfile.folderVariants,
    [current]: {
      folderStructure: lastProfile.folderStructure,
      leafCategories: lastProfile.leafCategories,
    },
  };
  select.disabled = true;
  $("#analyze-interests").disabled = true;
  status.textContent = "폴더 이름 변경 중…";
  status.classList.remove("error");
  status.hidden = false;
  try {
    if (!variants[target]) {
      if (!(await ensureOriginPermission(settings.endpoint))) throw new Error("백엔드 접근 권한이 필요해요.");
      variants[target] = await postJson("/api/profile/folder-language", {
        folderStructure: lastProfile.folderStructure,
        folderLanguage: target,
      });
    }
    const nextProfile = { ...lastProfile, ...variants[target], folderLanguage: target, folderVariants: variants };
    await chrome.storage.local.set({ lastProfile: nextProfile });
    await chrome.storage.sync.set({ folderLanguage: target });
    lastProfile = nextProfile;
    settings.folderLanguage = target;
    renderFolderStructure(lastProfile);
    status.hidden = true;
  } catch (error) {
    select.value = current;
    status.textContent = error.message;
    status.classList.add("error");
  } finally {
    select.disabled = false;
    $("#analyze-interests").disabled = false;
  }
}

/* ---------- settings ---------- */

async function checkServer({ report = false } = {}) {
  const pill = el.serverPill;
  const label = pill.querySelector("span");
  try {
    const response = await fetch(`${endpointBase()}/health`);
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error();
    serverHealth = body;
    renderPoeWarning();
    pill.dataset.state = body.configured ? "ok" : "warn";
    label.textContent = body.configured ? "서버 연결됨" : "API 키 없음";
    if (report) {
      setStatus(
        el.endpointStatus,
        body.configured ? "서버와 API 키가 준비됐어요." : "서버는 켜져 있지만 TYPESAFE_API_KEY가 없어요.",
        body.configured ? "success" : "error",
      );
    }
  } catch {
    pill.dataset.state = "error";
    label.textContent = "서버 꺼짐";
    if (report) setStatus(el.endpointStatus, "서버에 연결할 수 없어요. `make`로 서버를 켜 주세요.", "error");
  }
}

async function saveEndpoint() {
  try {
    const value = normalizeEndpoint(el.endpoint.value.trim());
    if (!(await ensureOriginPermission(value))) throw new Error("해당 주소에 접근 권한이 필요해요.");
    settings.endpoint = value;
    el.endpoint.value = value;
    await chrome.storage.sync.set({ endpoint: value });
    setStatus(el.endpointStatus, "저장했어요. 연결을 확인하는 중…");
    await checkServer({ report: true });
  } catch (error) {
    setStatus(el.endpointStatus, error.message, "error");
  }
}

async function saveBehavior() {
  settings.autoClassify = el.autoClassify.checked;
  settings.autoSave = el.autoSave.checked;
  settings.confidenceThreshold = Number(el.threshold.value);
  await chrome.storage.sync.set({
    autoClassify: settings.autoClassify,
    autoSave: settings.autoSave,
    confidenceThreshold: settings.confidenceThreshold,
  });
  setStatus(el.settingsStatus, "저장했어요.", "success");
}

function renderThreshold() {
  el.thresholdValue.textContent = `${Math.round(Number(el.threshold.value) * 100)}%`;
}

/* ---------- boot ---------- */

async function loadBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  rawTree = tree;
  inboxParentIds = new Set(
    (tree[0]?.children || [])
      .filter((folder) => !folder.url && folder.folderType !== "managed" && !folder.unmodifiable)
      .map((folder) => folder.id),
  );
  folderTree = buildFolderTree(tree);
  folderById.clear();
  const walk = (nodes) => nodes.forEach((node) => {
    folderById.set(node.id, node);
    walk(node.children);
  });
  walk(folderTree);
  allBookmarks = collectBookmarks(tree);
  for (const picker of [scopePicker, rootParentPicker]) {
    picker.setTree(folderTree);
    picker.setDisabled(folderTree.length === 0);
    if (!picker.value && folderTree[0]) picker.setValue(folderTree[0].id);
  }
  targetIds = new Set([...targetIds].filter((id) => folderById.has(id)));
  renderTargetTree();
  renderRootNotes();
  updateScopeCount();
  buildCheckupItems();
}

async function migrateLegacyRootName() {
  const { batchRootName } = await chrome.storage.sync.get("batchRootName");
  if (batchRootName) return;
  const legacy = (await chrome.bookmarks.search({ title: LEGACY_ROOT_NAME })).find((node) => !node.url);
  if (!legacy) return;
  settings.batchRootName = LEGACY_ROOT_NAME;
  await chrome.storage.sync.set({ batchRootName: LEGACY_ROOT_NAME });
}

async function initialize() {
  settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
  await migrateLegacyRootName();
  el.endpoint.value = settings.endpoint;
  el.autoClassify.checked = settings.autoClassify;
  el.autoSave.checked = settings.autoSave;
  el.threshold.value = settings.confidenceThreshold;
  $("#folder-language").value = settings.folderLanguage === "en" ? "en" : "ko";
  renderThreshold();
  el.rootName.value = settings.batchRootName || DEFAULT_SETTINGS.batchRootName;
  const savedCategories = Array.isArray(settings.batchCategories)
    ? parseCategories(settings.batchCategories.join("\n"))
    : parseCategories(settings.batchCategories);
  categories = savedCategories.length >= 2 ? savedCategories : [...DEFAULT_CATEGORIES];
  renderCategories();

  const local = await chrome.storage.local.get(["organizeMode", "existingTargetIds", "usageTopics", "deadLinks", "staleDays"]);
  if ([180, 365, 730, 1095, 1460, 1825].includes(local.staleDays)) staleDays = local.staleDays;
  el.usageTopics.checked = local.usageTopics !== false;
  deadLinks = local.deadLinks?.results || [];
  deadCheckedAt = local.deadLinks?.checkedAt || 0;
  await loadVisits().catch(() => {});
  renderHistoryNote();
  const hadTargets = Array.isArray(local.existingTargetIds);
  targetIds = new Set(local.existingTargetIds || []);
  await loadBookmarks();
  if (!hadTargets) {
    // Chrome's root folders (북마크바, 기타 북마크) are too broad to be useful destinations.
    const rootIds = new Set(folderTree.map((folder) => folder.id));
    targetIds = new Set(
      flattenFolderTree(folderTree)
        .filter((folder) => !rootIds.has(folder.id))
        .slice(0, MAX_TARGET_FOLDERS)
        .map((folder) => folder.id),
    );
    renderTargetTree();
  }
  setMode(Object.hasOwn(ANALYZE_LABELS, local.organizeMode) ? local.organizeMode : "new");
  setScope("all");
  const initialView = location.hash.slice(1);
  showView(["settings", "insights", "checkup"].includes(initialView) ? initialView : "organize");
  await renderUndoBanner();
  $("#insight-count").textContent = allBookmarks.length.toLocaleString();
  await checkServer();
  renderModePreview();
  await loadLatestProfile();
}

document.querySelectorAll(".nav-tab").forEach((tab) => {
  tab.addEventListener("click", () => showView(tab.dataset.view));
});
document.querySelectorAll(".mode-card").forEach((card) => {
  card.addEventListener("click", () => setMode(card.dataset.mode));
});
document.querySelectorAll("[data-scope]").forEach((button) => {
  button.addEventListener("click", () => setScope(button.dataset.scope));
});
el.rootName.addEventListener("change", () => {
  chrome.storage.sync.set({ batchRootName: rootName() });
  renderRootNotes();
  buildCheckupItems();
});
el.usageTopics.addEventListener("change", () => {
  chrome.storage.local.set({ usageTopics: el.usageTopics.checked });
  renderUsagePreview();
});
el.grantHistory.addEventListener("click", () => {
  grantHistory().catch((error) => setStatus(el.batchStatus, error.message, "error"));
});

$("#check-links").addEventListener("click", checkDeadLinks);
$("#cancel-links").addEventListener("click", () => linkController?.abort());
$("#apply-checkup").addEventListener("click", () => applyCheckup());
$("#view-checkup").addEventListener("change", (event) => {
  const key = event.target.dataset.key;
  if (!key) return;
  const item = checkupItems.find((candidate) => candidate.key === key);
  if (item) item.checked = event.target.checked;
  renderStaleControls();
  renderCheckupSummary();
});
$("#stale-period").addEventListener("change", (event) => {
  staleDays = Number(event.target.value);
  chrome.storage.local.set({ staleDays });
  buildCheckupItems();
});
$("#stale-toggle-all").addEventListener("click", () => {
  const stale = checkupItems.filter((item) => item.kind === "stale");
  const check = !stale.every((item) => item.checked);
  for (const item of stale) item.checked = check;
  renderCheckup();
});
$("#checkup-stats").addEventListener("click", (event) => {
  const kind = event.target.closest("[data-kind]")?.dataset.kind;
  if (kind) document.querySelector(`.checkup-section[data-kind="${kind}"]`).scrollIntoView({ behavior: "smooth", block: "start" });
});
el.categoryInput.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === ",") && !event.isComposing) {
    event.preventDefault();
    addCategoriesFromInput();
  } else if (event.key === "Backspace" && !el.categoryInput.value && categories.length) {
    categories = categories.slice(0, -1);
    renderCategories();
    saveCategories();
  }
});
el.categoryInput.addEventListener("blur", addCategoriesFromInput);
$("#reset-categories").addEventListener("click", () => {
  categories = [...DEFAULT_CATEGORIES];
  renderCategories();
  saveCategories();
});

el.targetSearch.addEventListener("input", renderTargetTree);
el.targetTree.addEventListener("change", (event) => {
  const id = event.target.dataset.folderId;
  if (!id) return;
  if (event.target.checked) targetIds.add(id);
  else targetIds.delete(id);
  updateTargetCount();
  saveTargets();
});
$("#targets-all").addEventListener("click", () => {
  el.targetTree.querySelectorAll("input[data-folder-id]").forEach((input) => targetIds.add(input.dataset.folderId));
  renderTargetTree();
  saveTargets();
});
$("#targets-none").addEventListener("click", () => {
  el.targetTree.querySelectorAll("input[data-folder-id]").forEach((input) => targetIds.delete(input.dataset.folderId));
  renderTargetTree();
  saveTargets();
});

el.analyze.addEventListener("click", analyze);
$("#analyze-interests").addEventListener("click", analyzeInterests);
$("#folder-language").addEventListener("change", changeFolderLanguage);
$("#cancel-interests").addEventListener("click", () => insightController?.abort());
$("#use-structure").addEventListener("click", () => useProfileStructure({ analyzeNow: true }));
$("#download-snapshot").addEventListener("click", downloadSnapshot);
$("#suggest-categories").addEventListener("click", () => {
  if (lastProfile) useProfileStructure();
  else showView("insights");
});
el.cancel.addEventListener("click", () => abortController?.abort());
el.apply.addEventListener("click", () => applyPlan());
el.undoButton.addEventListener("click", undoLastBatch);

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    renderPlan();
  });
});
el.planGroups.addEventListener("click", (event) => {
  const toggle = event.target.closest(".group-toggle");
  if (!toggle) return;
  const { destination } = toggle.closest(".plan-group").dataset;
  if (collapsedGroups.has(destination)) collapsedGroups.delete(destination);
  else collapsedGroups.add(destination);
  renderPlan();
});
el.planGroups.addEventListener("change", (event) => {
  const target = event.target;
  if (target.classList.contains("item-check")) {
    findItem(target.dataset.itemId).checked = target.checked;
  } else if (target.classList.contains("group-check")) {
    const { destination } = target.closest(".plan-group").dataset;
    visibleItems()
      .filter((item) => item.destination === destination)
      .forEach((item) => {
        item.checked = target.checked;
      });
  } else if (target.classList.contains("dest-select")) {
    const item = findItem(target.dataset.itemId);
    item.destination = target.value;
    item.checked = Boolean(target.value);
    item.needsReview = false;
    item.alreadyThere = isAlreadyThere(item, target.value);
    if (item.alreadyThere) item.checked = false;
  } else {
    return;
  }
  renderPlan();
});

el.endpoint.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveEndpoint();
});
$("#save-endpoint").addEventListener("click", saveEndpoint);
el.autoClassify.addEventListener("change", saveBehavior);
el.autoSave.addEventListener("change", saveBehavior);
el.threshold.addEventListener("input", renderThreshold);
el.threshold.addEventListener("change", saveBehavior);

initialize().catch((error) => setStatus(el.batchStatus, error.message, "error"));
