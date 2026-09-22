import { chunkItems, isBatchMoveEligible, parseCategories } from "./options-utils.js";

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
  autoSave: false,
  confidenceThreshold: 0.78,
  batchRootName: "JEV 정리함",
  batchCategories: DEFAULT_CATEGORIES,
};

const endpoint = document.querySelector("#endpoint");
const autoSave = document.querySelector("#auto-save");
const threshold = document.querySelector("#threshold");
const status = document.querySelector("#status");
const batchRootName = document.querySelector("#batch-root-name");
const batchParent = document.querySelector("#batch-parent");
const batchCategories = document.querySelector("#batch-categories");
const batchStatus = document.querySelector("#batch-status");
const batchProgress = document.querySelector("#batch-progress");
const batchResults = document.querySelector("#batch-results");
const batchSummary = document.querySelector("#batch-summary");
const batchResultList = document.querySelector("#batch-result-list");
const analyzeBatchButton = document.querySelector("#analyze-batch");
const applyBatchButton = document.querySelector("#apply-batch");
const undoBatchButton = document.querySelector("#undo-batch");
const toggleAll = document.querySelector("#toggle-all");

let batchAnalysis = [];
let folderIndex = [];

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function setBatchStatus(message, kind = "") {
  batchStatus.textContent = message;
  batchStatus.className = `status ${kind}`.trim();
}

function flattenBookmarkTree(nodes, parentPath = "") {
  const folders = [];
  const bookmarks = [];
  for (const node of nodes) {
    const path = node.title ? (parentPath ? `${parentPath} / ${node.title}` : node.title) : parentPath;
    if (node.children && node.title) folders.push({ id: node.id, path });
    if (node.url) {
      bookmarks.push({ id: node.id, title: node.title, url: node.url, currentPath: parentPath });
    }
    if (node.children) {
      const nested = flattenBookmarkTree(node.children, path);
      folders.push(...nested.folders);
      bookmarks.push(...nested.bookmarks);
    }
  }
  return { folders, bookmarks };
}

function renderParentFolders() {
  batchParent.replaceChildren();
  for (const folder of folderIndex) {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.path;
    batchParent.append(option);
  }
}

function normalizeEndpoint(value) {
  const url = new URL(value);
  if (!/^https?:$/.test(url.protocol)) throw new Error("HTTP 또는 HTTPS 주소를 입력하세요.");
  return url.origin + url.pathname.replace(/\/$/, "");
}

async function ensureOriginPermission(urlValue) {
  const url = new URL(urlValue);
  const originPattern = `${url.protocol}//${url.hostname}/*`;
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return true;
  const alreadyGranted = await chrome.permissions.contains({ origins: [originPattern] });
  return alreadyGranted || chrome.permissions.request({ origins: [originPattern] });
}

async function saveSettings() {
  try {
    const endpointValue = normalizeEndpoint(endpoint.value.trim());
    const thresholdValue = Number(threshold.value);
    const categoryValues = parseCategories(batchCategories.value);
    if (thresholdValue < 0.5 || thresholdValue > 1) {
      throw new Error("confidence 기준은 0.50에서 1.00 사이여야 합니다.");
    }
    if (categoryValues.length < 2) {
      throw new Error("일괄 정리 카테고리는 두 개 이상 입력하세요.");
    }
    if (!(await ensureOriginPermission(endpointValue))) {
      throw new Error("해당 백엔드 주소에 접근 권한이 필요합니다.");
    }
    await chrome.storage.sync.set({
      endpoint: endpointValue,
      autoSave: autoSave.checked,
      confidenceThreshold: thresholdValue,
      batchRootName: batchRootName.value.trim() || DEFAULT_SETTINGS.batchRootName,
      batchCategories: categoryValues,
    });
    endpoint.value = endpointValue;
    setStatus("설정을 저장했습니다.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function renderBatchResults(savedThreshold) {
  batchResultList.replaceChildren();
  const eligibleCount = batchAnalysis.filter((item) => isBatchMoveEligible(item, savedThreshold)).length;
  batchSummary.textContent = `${batchAnalysis.length}개 분석 · ${eligibleCount}개 기본 선택`;
  for (const item of batchAnalysis) {
    const eligible = isBatchMoveEligible(item, savedThreshold);
    const row = document.createElement("div");
    row.className = `batch-result-item${eligible ? "" : " needs-review"}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.bookmarkId = item.id;
    checkbox.checked = eligible;
    checkbox.disabled = !item.category;
    checkbox.setAttribute("aria-label", `${item.title} 이동`);

    const copy = document.createElement("div");
    copy.className = "batch-bookmark-copy";
    const title = document.createElement("p");
    title.className = "batch-bookmark-title";
    title.textContent = item.title || item.url;
    const path = document.createElement("p");
    path.className = "batch-bookmark-path";
    path.textContent = item.currentPath || "현재 폴더 없음";
    copy.append(title, path);

    const destination = document.createElement("div");
    destination.className = "batch-destination";
    const category = document.createElement("strong");
    category.textContent = item.category || "분류 보류";
    const confidence = document.createElement("span");
    confidence.textContent = `${Math.round(item.confidence * 100)}% confidence`;
    destination.append(category, confidence);
    row.append(checkbox, copy, destination);
    batchResultList.append(row);
  }
  batchResults.hidden = false;
  applyBatchButton.disabled = eligibleCount === 0;
  toggleAll.checked = false;
}

async function analyzeAllBookmarks() {
  analyzeBatchButton.disabled = true;
  applyBatchButton.disabled = true;
  batchResults.hidden = true;
  batchProgress.style.width = "0%";
  try {
    const categories = parseCategories(batchCategories.value);
    if (categories.length < 2) throw new Error("정리 카테고리를 두 개 이상 입력하세요.");
    const endpointValue = normalizeEndpoint(endpoint.value.trim());
    if (!(await ensureOriginPermission(endpointValue))) throw new Error("백엔드 접근 권한이 없습니다.");
    const tree = await chrome.bookmarks.getTree();
    const { bookmarks } = flattenBookmarkTree(tree);
    if (bookmarks.length === 0) throw new Error("검토할 URL 북마크가 없습니다.");

    batchAnalysis = [];
    const batches = chunkItems(bookmarks, 20);
    for (let index = 0; index < batches.length; index += 1) {
      setBatchStatus(`${bookmarks.length}개 중 ${batchAnalysis.length}개 분석 완료…`);
      const response = await fetch(`${endpointValue}/api/classify-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookmarks: batches[index], categories }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `서버 오류 (${response.status})`);
      batchAnalysis.push(...body.results);
      batchProgress.style.width = `${Math.round(((index + 1) / batches.length) * 100)}%`;
    }
    const savedThreshold = Number(threshold.value);
    renderBatchResults(savedThreshold);
    setBatchStatus("분석이 끝났습니다. 이동 예정 항목을 확인한 뒤 적용하세요.", "success");
  } catch (error) {
    setBatchStatus(error.message || "전체 북마크 분석에 실패했습니다.", "error");
  } finally {
    analyzeBatchButton.disabled = false;
  }
}

async function findOrCreateFolder(parentId, title) {
  const children = await chrome.bookmarks.getChildren(parentId);
  const existing = children.find(
    (item) => !item.url && item.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
  );
  if (existing) return { folder: existing, created: false };
  return { folder: await chrome.bookmarks.create({ parentId, title }), created: true };
}

async function applyBatchOrganization() {
  const selectedIds = new Set(
    [...batchResultList.querySelectorAll('input[type="checkbox"]:checked')].map(
      (input) => input.dataset.bookmarkId,
    ),
  );
  const selected = batchAnalysis.filter((item) => selectedIds.has(item.id) && item.category);
  if (selected.length === 0) return;
  const rootTitle = batchRootName.value.trim();
  if (!rootTitle) throw new Error("새 정리 폴더 이름을 입력하세요.");
  if (!window.confirm(`${selected.length}개 북마크를 “${rootTitle}” 아래로 이동할까요?`)) return;

  applyBatchButton.disabled = true;
  const undoMoves = [];
  const createdFolderIds = [];
  try {
    const rootResult = await findOrCreateFolder(batchParent.value, rootTitle);
    const rootFolder = rootResult.folder;
    if (rootResult.created) createdFolderIds.push(rootFolder.id);
    const categoryFolders = new Map();
    for (const category of new Set(selected.map((item) => item.category))) {
      const categoryResult = await findOrCreateFolder(rootFolder.id, category);
      categoryFolders.set(category, categoryResult.folder);
      if (categoryResult.created) createdFolderIds.push(categoryResult.folder.id);
    }

    for (let index = 0; index < selected.length; index += 1) {
      const item = selected[index];
      const [current] = await chrome.bookmarks.get(item.id);
      const destination = categoryFolders.get(item.category);
      if (!current || current.parentId === destination.id) continue;
      undoMoves.push({ id: item.id, parentId: current.parentId, index: current.index });
      await chrome.bookmarks.move(item.id, { parentId: destination.id });
      setBatchStatus(`${selected.length}개 중 ${index + 1}개 이동 중…`);
    }
    await chrome.storage.local.set({
      lastBatchUndo: { moves: undoMoves, createdFolderIds, createdAt: Date.now() },
    });
    undoBatchButton.disabled = undoMoves.length === 0;
    setBatchStatus(`${undoMoves.length}개 북마크를 새 폴더 구조로 정리했습니다.`, "success");
    applyBatchButton.disabled = true;
  } catch (error) {
    if (undoMoves.length > 0 || createdFolderIds.length > 0) {
      await chrome.storage.local.set({
        lastBatchUndo: { moves: undoMoves, createdFolderIds, createdAt: Date.now() },
      });
      undoBatchButton.disabled = undoMoves.length === 0;
    }
    applyBatchButton.disabled = false;
    setBatchStatus(`${error.message || "일괄 정리에 실패했습니다."} 이동된 항목은 되돌릴 수 있습니다.`, "error");
  }
}

async function undoLastBatch() {
  const { lastBatchUndo } = await chrome.storage.local.get("lastBatchUndo");
  const moves = lastBatchUndo?.moves || [];
  if (moves.length === 0) return;
  undoBatchButton.disabled = true;
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
  setBatchStatus(`${restored}개 북마크를 이전 위치로 되돌렸습니다.`, restored === moves.length ? "success" : "error");
}

async function testConnection() {
  try {
    const endpointValue = normalizeEndpoint(endpoint.value.trim());
    if (!(await ensureOriginPermission(endpointValue))) throw new Error("접근 권한이 없습니다.");
    setStatus("서버에 연결하는 중…");
    const response = await fetch(`${endpointValue}/health`);
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error("서버가 정상 응답하지 않았습니다.");
    setStatus(
      body.configured ? "서버와 JEV API 키가 준비되었습니다." : "서버는 켜져 있지만 TYPESAFE_API_KEY가 없습니다.",
      body.configured ? "success" : "error",
    );
  } catch (error) {
    setStatus(error.message || "서버에 연결할 수 없습니다.", "error");
  }
}

async function initialize() {
  const settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
  endpoint.value = settings.endpoint;
  autoSave.checked = settings.autoSave;
  threshold.value = settings.confidenceThreshold;
  batchRootName.value = settings.batchRootName || DEFAULT_SETTINGS.batchRootName;
  const savedCategories = Array.isArray(settings.batchCategories)
    ? settings.batchCategories
    : parseCategories(settings.batchCategories);
  batchCategories.value = (savedCategories.length >= 2 ? savedCategories : DEFAULT_CATEGORIES).join("\n");
  const tree = await chrome.bookmarks.getTree();
  folderIndex = flattenBookmarkTree(tree).folders;
  renderParentFolders();
  const { lastBatchUndo } = await chrome.storage.local.get("lastBatchUndo");
  undoBatchButton.disabled = !lastBatchUndo?.moves?.length;
}

document.querySelector("#save").addEventListener("click", saveSettings);
document.querySelector("#test").addEventListener("click", testConnection);
analyzeBatchButton.addEventListener("click", analyzeAllBookmarks);
applyBatchButton.addEventListener("click", () => applyBatchOrganization().catch((error) => setBatchStatus(error.message, "error")));
undoBatchButton.addEventListener("click", undoLastBatch);
toggleAll.addEventListener("change", () => {
  batchResultList.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((input) => {
    input.checked = toggleAll.checked;
  });
  applyBatchButton.disabled = !batchResultList.querySelector('input[type="checkbox"]:checked');
});
batchResultList.addEventListener("change", () => {
  applyBatchButton.disabled = !batchResultList.querySelector('input[type="checkbox"]:checked');
});
initialize();
