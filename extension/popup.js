import { shouldSuggestNewFolder, suggestFolderName } from "./popup-utils.js";

const DEFAULT_SETTINGS = {
  endpoint: "http://127.0.0.1:8787",
  autoSave: false,
  confidenceThreshold: 0.78,
};

const elements = {
  classify: document.querySelector("#classify"),
  confidence: document.querySelector("#confidence"),
  candidates: document.querySelector("#candidates"),
  createFolder: document.querySelector("#create-folder"),
  folderSelect: document.querySelector("#folder-select"),
  newFolder: document.querySelector("#new-folder"),
  newFolderName: document.querySelector("#new-folder-name"),
  newFolderParent: document.querySelector("#new-folder-parent"),
  newFolderReason: document.querySelector("#new-folder-reason"),
  openOptions: document.querySelector("#open-options"),
  pageHost: document.querySelector("#page-host"),
  pageTitle: document.querySelector("#page-title"),
  result: document.querySelector("#result"),
  resultTitle: document.querySelector("#result-title"),
  save: document.querySelector("#save"),
  siteIcon: document.querySelector("#site-icon"),
  status: document.querySelector("#status"),
};

let activeTab;
let folders = [];
let settings = DEFAULT_SETTINGS;
let existingBookmark;

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${kind}`.trim();
}

function flattenFolders(nodes, parentPath = "") {
  const result = [];
  for (const node of nodes) {
    const path = node.title ? (parentPath ? `${parentPath} / ${node.title}` : node.title) : parentPath;
    if (node.children && node.title) result.push({ id: node.id, path });
    if (node.children) result.push(...flattenFolders(node.children, path));
  }
  return result;
}

function renderFolders() {
  elements.folderSelect.replaceChildren();
  elements.newFolderParent.replaceChildren();
  for (const folder of folders) {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.path;
    elements.folderSelect.append(option);

    const parentOption = option.cloneNode(true);
    elements.newFolderParent.append(parentOption);
  }
  elements.folderSelect.disabled = folders.length === 0;
  elements.save.disabled = folders.length === 0;
}

async function getPageContext() {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => ({
        description:
          document.querySelector('meta[name="description"]')?.content ||
          document.querySelector('meta[property="og:description"]')?.content ||
          window.getSelection()?.toString() ||
          "",
      }),
    });
    return result || { description: "" };
  } catch {
    return { description: "" };
  }
}

function selectFolder(folderId) {
  elements.folderSelect.value = folderId;
  document.querySelectorAll(".candidate").forEach((button) => {
    button.classList.toggle("selected", button.dataset.folderId === folderId);
  });
}

function renderResult(result) {
  elements.result.hidden = false;
  elements.confidence.textContent = `${Math.round(result.confidence * 100)}% confidence`;
  elements.resultTitle.textContent = result.recommendation
    ? "가장 잘 맞는 폴더"
    : "확실한 폴더가 없어요";
  elements.candidates.replaceChildren();

  for (const candidate of result.candidates) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate";
    button.dataset.folderId = candidate.id;
    const path = document.createElement("span");
    path.textContent = candidate.path;
    const probability = document.createElement("span");
    probability.textContent = `${Math.round(candidate.probability * 100)}%`;
    button.append(path, probability);
    button.addEventListener("click", () => selectFolder(candidate.id));
    elements.candidates.append(button);
  }

  if (result.recommendation) selectFolder(result.recommendation.id);
  const suggestNewFolder = shouldSuggestNewFolder(result, settings.confidenceThreshold);
  elements.newFolder.hidden = !suggestNewFolder;
  if (suggestNewFolder) {
    const thresholdPercent = Math.round(settings.confidenceThreshold * 100);
    const confidencePercent = Math.round(result.confidence * 100);
    elements.newFolderReason.textContent = result.recommendation
      ? `confidence ${confidencePercent}%가 저장한 기준 ${thresholdPercent}% 이하입니다.`
      : "기존 폴더 중 적합한 항목이 없어 새 폴더를 제안합니다.";
    elements.newFolderName.value = suggestFolderName(activeTab);
    elements.newFolderParent.value = result.candidates[0]?.id || folders[0]?.id || "";
  }
  if (result.truncatedFolderCount > 0) {
    setStatus(`폴더가 많아 처음 100개만 비교했습니다. (${result.truncatedFolderCount}개 제외)`);
  } else {
    setStatus(result.recommendation ? "추천을 확인하고 저장하세요." : "직접 폴더를 선택해 주세요.");
  }
}

async function upsertBookmark(parentId) {
  if (existingBookmark) {
    await chrome.bookmarks.move(existingBookmark.id, { parentId });
  } else {
    existingBookmark = await chrome.bookmarks.create({
      parentId,
      title: activeTab.title || activeTab.url,
      url: activeTab.url,
    });
  }
}

async function saveBookmark({ automatic = false } = {}) {
  const parentId = elements.folderSelect.value;
  if (!parentId || !activeTab?.url) return;
  elements.save.disabled = true;
  try {
    await upsertBookmark(parentId);
    elements.save.textContent = "저장 완료 ✓";
    setStatus(automatic ? "높은 confidence로 자동 저장했습니다." : "북마크를 저장했습니다.", "success");
  } catch (error) {
    elements.save.disabled = false;
    setStatus(error.message || "북마크를 저장하지 못했습니다.", "error");
  }
}

async function createFolderAndSave() {
  const title = elements.newFolderName.value.trim();
  const parentId = elements.newFolderParent.value;
  if (!title) {
    elements.newFolderName.focus();
    setStatus("새 폴더 이름을 입력해 주세요.", "error");
    return;
  }
  if (!parentId || !activeTab?.url) return;

  elements.createFolder.disabled = true;
  try {
    const children = await chrome.bookmarks.getChildren(parentId);
    let folder = children.find(
      (item) => !item.url && item.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
    );
    if (!folder) folder = await chrome.bookmarks.create({ parentId, title });
    await upsertBookmark(folder.id);

    const parent = folders.find((item) => item.id === parentId);
    const path = parent ? `${parent.path} / ${folder.title}` : folder.title;
    if (!folders.some((item) => item.id === folder.id)) folders.push({ id: folder.id, path });
    renderFolders();
    elements.folderSelect.value = folder.id;
    elements.newFolder.hidden = true;
    elements.save.textContent = "저장 완료 ✓";
    elements.save.disabled = true;
    setStatus(`“${folder.title}” 폴더를 만들고 북마크를 저장했습니다.`, "success");
  } catch (error) {
    elements.createFolder.disabled = false;
    setStatus(error.message || "새 폴더를 만들지 못했습니다.", "error");
  }
}

async function classify() {
  elements.classify.disabled = true;
  elements.classify.innerHTML = '<span class="spark">✦</span> 분류하는 중…';
  setStatus("페이지와 폴더를 JEV가 비교하고 있습니다.");
  try {
    const pageContext = await getPageContext();
    const response = await fetch(`${settings.endpoint.replace(/\/$/, "")}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: {
          title: activeTab.title,
          url: activeTab.url,
          description: pageContext.description,
        },
        folders,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `서버 오류 (${response.status})`);
    renderResult(result);
    if (
      settings.autoSave &&
      result.recommendation &&
      result.confidence > settings.confidenceThreshold
    ) {
      await saveBookmark({ automatic: true });
    }
  } catch (error) {
    setStatus(`${error.message} 설정에서 백엔드 주소를 확인하세요.`, "error");
  } finally {
    elements.classify.disabled = false;
    elements.classify.innerHTML = '<span class="spark">✦</span> 다시 분류하기';
  }
}

async function initialize() {
  settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.url) {
    elements.pageTitle.textContent = "이 페이지는 읽을 수 없습니다.";
    setStatus("일반 웹페이지에서 다시 열어 주세요.", "error");
    return;
  }

  elements.pageTitle.textContent = activeTab.title || "제목 없는 페이지";
  try {
    const url = new URL(activeTab.url);
    elements.pageHost.textContent = url.hostname || activeTab.url;
    elements.siteIcon.textContent = (url.hostname.replace(/^www\./, "")[0] || "↗").toUpperCase();
  } catch {
    elements.pageHost.textContent = activeTab.url;
  }

  const tree = await chrome.bookmarks.getTree();
  folders = flattenFolders(tree);
  renderFolders();
  [existingBookmark] = await chrome.bookmarks.search({ url: activeTab.url });
  if (existingBookmark) {
    elements.save.textContent = "기존 북마크를 이 폴더로 이동";
    elements.folderSelect.value = existingBookmark.parentId;
  }
  elements.classify.disabled = folders.length === 0;
  if (folders.length === 0) setStatus("먼저 Chrome에 북마크 폴더를 하나 만들어 주세요.", "error");
}

elements.classify.addEventListener("click", classify);
elements.createFolder.addEventListener("click", createFolderAndSave);
elements.save.addEventListener("click", () => saveBookmark());
elements.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
initialize().catch((error) => setStatus(error.message, "error"));
