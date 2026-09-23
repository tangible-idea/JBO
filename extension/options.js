import { createFolderPicker } from "./folder-picker.js";
import {
  chunkItems,
  collectBookmarks,
  groupPlan,
  mapWithConcurrency,
  parseCategories,
  toPlanItem,
} from "./options-utils.js";
import { buildFolderTree, flattenFolderTree } from "./popup-utils.js";

const DEFAULT_CATEGORIES = [
  "개발 및 기술",
  "AI 및 데이터",
  "디자인",
  "비즈니스 및 커리어",
  "학습 및 참고",
  "뉴스 및 읽을거리",
  "쇼핑",
  "엔터테인먼트",
  "여행",
  "금융",
];

const DEFAULT_SETTINGS = {
  endpoint: "http://127.0.0.1:8787",
  autoClassify: true,
  autoSave: false,
  confidenceThreshold: 0.78,
  batchRootName: "JEV 정리함",
  batchCategories: DEFAULT_CATEGORIES,
};

const MAX_TARGET_FOLDERS = 100;
const BATCH_SIZE = { new: 20, existing: 10 };
const CONCURRENCY = 3;

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

const scopePicker = createFolderPicker($("#scope-picker"), { onChange: updateScopeCount });
const rootParentPicker = createFolderPicker($("#root-parent-picker"));

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
  el.analyzeLabel.textContent = mode === "new" ? "새 폴더 구조로 분석하기" : "기존 폴더 기준으로 분석하기";
  chrome.storage.local.set({ organizeMode: mode });
}

function setScope(nextScope) {
  scope = nextScope;
  document.querySelectorAll("[data-scope]").forEach((button) => {
    button.setAttribute("aria-checked", String(button.dataset.scope === scope));
  });
  $("#scope-picker").hidden = scope !== "folder";
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

function scopedBookmarks() {
  if (scope === "all" || !scopePicker.value) return allBookmarks;
  const ids = descendantFolderIds(scopePicker.value);
  return allBookmarks.filter((bookmark) => ids.has(bookmark.parentId));
}

function updateScopeCount() {
  const count = scopedBookmarks().length;
  const where = scope === "folder" && scopePicker.selected ? `‘${scopePicker.selected.title}’ 안의 ` : "";
  el.scopeCount.textContent = `${where}북마크 ${count.toLocaleString()}개를 분석해요.`;
}

/* ---------- categories (mode A) ---------- */

function saveCategories() {
  chrome.storage.sync.set({ batchCategories: categories });
}

function renderCategories() {
  el.categoryChips.querySelectorAll(".chip").forEach((chip) => chip.remove());
  for (const category of categories) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = category;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `${category} 삭제`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      categories = categories.filter((item) => item !== category);
      renderCategories();
      saveCategories();
    });
    chip.append(remove);
    el.categoryChips.insertBefore(chip, el.categoryInput);
  }
  el.categoryCount.textContent = `${categories.length}개`;
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
  if (!key) return "분류 보류";
  if (key.startsWith("category:")) return key.slice("category:".length);
  return folderById.get(key.slice("folder:".length))?.path || "삭제된 폴더";
}

async function analyze() {
  const bookmarks = scopedBookmarks();
  let request;
  let destinations;
  try {
    if (bookmarks.length === 0) throw new Error("정리할 북마크가 없어요.");
    if (mode === "new") {
      if (categories.length < 2) throw new Error("카테고리를 두 개 이상 만들어 주세요.");
      if (!el.rootName.value.trim()) throw new Error("정리 폴더 이름을 입력해 주세요.");
      destinations = categories.map((category) => ({ key: `category:${category}`, label: category }));
      request = { categories };
    } else {
      const targets = [...targetIds]
        .map((id) => folderById.get(id))
        .filter(Boolean)
        .map((folder) => ({ id: folder.id, path: folder.path }));
      if (targets.length === 0) throw new Error("넣을 수 있는 폴더를 하나 이상 체크해 주세요.");
      if (targets.length > MAX_TARGET_FOLDERS) throw new Error(`대상 폴더는 ${MAX_TARGET_FOLDERS}개까지 고를 수 있어요.`);
      destinations = targets.map((folder) => ({ key: `folder:${folder.id}`, label: folder.path }));
      request = { folders: targets };
    }
    if (!(await ensureOriginPermission(settings.endpoint))) throw new Error("백엔드 접근 권한이 필요해요.");
  } catch (error) {
    setStatus(el.batchStatus, error.message, "error");
    return;
  }

  abortController = new AbortController();
  const { signal } = abortController;
  el.analyze.disabled = true;
  el.cancel.hidden = false;
  el.plan.hidden = true;
  el.batchProgress.style.width = "0%";
  document.body.classList.add("is-analyzing");
  let completed = 0;
  setStatus(el.batchStatus, `북마크 ${bookmarks.length.toLocaleString()}개의 페이지 정보를 읽는 중…`);

  try {
    const batches = chunkItems(bookmarks, BATCH_SIZE[mode]);
    const results = await mapWithConcurrency(batches, CONCURRENCY, async (batch) => {
      const response = await fetch(`${endpointBase()}/api/classify-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, bookmarks: batch }),
        signal,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `서버 오류 (${response.status})`);
      completed += batch.length;
      el.batchProgress.style.width = `${Math.round((completed / bookmarks.length) * 100)}%`;
      setStatus(el.batchStatus, `${bookmarks.length.toLocaleString()}개 중 ${completed.toLocaleString()}개 분석 완료…`);
      return body.results;
    });
    const resultById = new Map(results.flat().map((result) => [result.id, result]));
    plan = {
      mode,
      rootName: el.rootName.value.trim(),
      rootParentId: rootParentPicker.value,
      destinations,
      items: bookmarks.map((bookmark) =>
        toPlanItem(bookmark, resultById.get(bookmark.id), settings.confidenceThreshold),
      ),
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
  const stats = [
    ["분석", items.length],
    ["옮길 항목", checked],
    ["검토 필요", items.filter((item) => item.needsReview).length],
    ["분류 보류", items.filter((item) => !item.destination).length],
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
}

function destinationSelect(item) {
  const select = document.createElement("select");
  select.className = "dest-select";
  select.dataset.itemId = item.id;
  select.setAttribute("aria-label", `${item.title || item.url} 옮길 곳`);
  const none = new Option("분류 보류 (그대로 두기)", "");
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
    const prefixText = plan.mode === "new" && group.destination
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
        meta.textContent = `${hostOf(item.url)} · 지금: ${item.currentPath || "최상위"}`;
        copy.append(title, meta);

        const score = document.createElement("span");
        score.className = "score";
        score.dataset.level = item.alreadyThere
          ? "same"
          : item.confidence > settings.confidenceThreshold
            ? "high"
            : "low";
        score.textContent = item.alreadyThere ? "제자리" : `${Math.round(item.confidence * 100)}%`;

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
  const message = plan.mode === "new"
    ? `북마크 ${selected.length}개를 ‘${plan.rootName}’ 아래 ${destinationCount}개 카테고리 폴더로 옮겨요.`
    : `북마크 ${selected.length}개를 기존 폴더 ${destinationCount}곳으로 옮겨요.`;
  if (!(await confirmApply(message))) return;

  el.apply.disabled = true;
  const undoMoves = [];
  const createdFolderIds = [];
  const saveUndo = () =>
    chrome.storage.local.set({
      lastBatchUndo: { moves: undoMoves, createdFolderIds, createdAt: Date.now() },
    });
  try {
    const folderIdFor = new Map();
    if (plan.mode === "new") {
      const root = await findOrCreateFolder(plan.rootParentId, plan.rootName);
      if (root.created) createdFolderIds.push(root.folder.id);
      for (const key of new Set(selected.map((item) => item.destination))) {
        const result = await findOrCreateFolder(root.folder.id, key.slice("category:".length));
        if (result.created) createdFolderIds.push(result.folder.id);
        folderIdFor.set(key, result.folder.id);
      }
    } else {
      for (const item of selected) folderIdFor.set(item.destination, item.destination.slice("folder:".length));
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
    await saveUndo();
    plan = null;
    el.plan.hidden = true;
    await loadBookmarks();
    await renderUndoBanner();
    setStatus(el.batchStatus, `북마크 ${undoMoves.length}개를 정리했어요.`, "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    if (undoMoves.length > 0 || createdFolderIds.length > 0) {
      await saveUndo();
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

async function renderUndoBanner() {
  const { lastBatchUndo } = await chrome.storage.local.get("lastBatchUndo");
  const count = lastBatchUndo?.moves?.length || 0;
  el.undoBanner.hidden = count === 0;
  if (count) el.undoText.textContent = `${timeAgo(lastBatchUndo.createdAt)} 북마크 ${count}개를 정리했어요.`;
}

async function undoLastBatch() {
  const { lastBatchUndo } = await chrome.storage.local.get("lastBatchUndo");
  const moves = lastBatchUndo?.moves || [];
  if (moves.length === 0) return;
  el.undoButton.disabled = true;
  let restored = 0;
  for (const move of [...moves].reverse()) {
    try {
      await chrome.bookmarks.move(move.id, { parentId: move.parentId, index: move.index });
      restored += 1;
    } catch {
      // Continue restoring the remaining bookmarks if one parent was deleted.
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
  setStatus(
    el.batchStatus,
    `북마크 ${restored}개를 원래 위치로 되돌렸어요.`,
    restored === moves.length ? "success" : "error",
  );
}

/* ---------- settings ---------- */

async function checkServer({ report = false } = {}) {
  const pill = el.serverPill;
  const label = pill.querySelector("span");
  try {
    const response = await fetch(`${endpointBase()}/health`);
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error();
    pill.dataset.state = body.configured ? "ok" : "warn";
    label.textContent = body.configured ? "JEV 연결됨" : "API 키 없음";
    if (report) {
      setStatus(
        el.endpointStatus,
        body.configured ? "서버와 JEV API 키가 준비됐어요." : "서버는 켜져 있지만 TYPESAFE_API_KEY가 없어요.",
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
  updateScopeCount();
}

async function initialize() {
  settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
  el.endpoint.value = settings.endpoint;
  el.autoClassify.checked = settings.autoClassify;
  el.autoSave.checked = settings.autoSave;
  el.threshold.value = settings.confidenceThreshold;
  renderThreshold();
  el.rootName.value = settings.batchRootName || DEFAULT_SETTINGS.batchRootName;
  const savedCategories = Array.isArray(settings.batchCategories)
    ? parseCategories(settings.batchCategories.join("\n"))
    : parseCategories(settings.batchCategories);
  categories = savedCategories.length >= 2 ? savedCategories : [...DEFAULT_CATEGORIES];
  renderCategories();

  const local = await chrome.storage.local.get(["organizeMode", "existingTargetIds"]);
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
  setMode(local.organizeMode === "existing" ? "existing" : "new");
  setScope("all");
  showView(location.hash === "#settings" ? "settings" : "organize");
  await renderUndoBanner();
  checkServer();
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
  chrome.storage.sync.set({ batchRootName: el.rootName.value.trim() || DEFAULT_SETTINGS.batchRootName });
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
    item.alreadyThere = target.value === `folder:${item.parentId}`;
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
