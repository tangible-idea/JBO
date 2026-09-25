import { localizeDocument, t } from "./i18n.js";
import { createFolderPicker } from "./folder-picker.js";
import {
  buildFolderTree,
  flattenFolderTree,
  shouldSuggestNewFolder,
  suggestFolderName,
} from "./popup-utils.js";

// Translate static HTML before anything below grabs element references.
localizeDocument();

const DEFAULT_SETTINGS = {
  endpoint: "https://tidymark-api-133930666159.asia-northeast3.run.app",
  autoClassify: true,
  autoSave: false,
  confidenceThreshold: 0.78,
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  classify: $("#classify"),
  newFolderHint: $("#new-folder-hint"),
  newFolderName: $("#new-folder-name"),
  newFolderPreview: $("#new-folder-preview"),
  pageHost: $("#page-host"),
  pageTitle: $("#page-title"),
  recommendations: $("#recommendations"),
  save: $("#save"),
  saveLabel: $("#save-label"),
  savedBadge: $("#saved-badge"),
  siteFavicon: $("#site-favicon"),
  siteLetter: $("#site-letter"),
  status: $("#status"),
  tabs: document.querySelectorAll(".mode-tab"),
  panels: document.querySelectorAll(".mode-panel"),
};

let activeTab;
let folderTree = [];
let folders = [];
let settings = DEFAULT_SETTINGS;
let existingBookmark;
let mode = "existing";
let busy = false;

const destinationPicker = createFolderPicker($("#destination-picker"), {
  onChange: () => {
    highlightRecommendation();
    updateAction();
  },
});
const parentPicker = createFolderPicker($("#parent-picker"), { onChange: updateAction });

function setStatus(message, kind = "") {
  elements.status.textContent = message;
  elements.status.className = `status ${kind}`.trim();
}

function findFolder(id, nodes = folderTree, parent = null) {
  for (const node of nodes) {
    if (node.id === id) return { node, parent };
    const found = findFolder(id, node.children, node);
    if (found) return found;
  }
  return null;
}

function folderTitle(id) {
  return findFolder(id)?.node.title || "";
}

function parentPath(path, title) {
  return path.endsWith(title) ? path.slice(0, -title.length).replace(/\s\/\s$/, "") : "";
}

function setMode(nextMode) {
  mode = nextMode;
  elements.tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.mode === mode)));
  elements.panels.forEach((panel) => {
    panel.hidden = panel.dataset.mode !== mode;
  });
  document.body.dataset.mode = mode;
  if (mode === "new") {
    elements.newFolderName.focus();
    elements.newFolderName.select();
  }
  updateAction();
}

function updateAction() {
  let label;
  let enabled = !busy && Boolean(activeTab?.url);
  if (mode === "existing") {
    const folder = destinationPicker.selected;
    if (!folder) {
      label = t("저장할 폴더를 선택하세요");
      enabled = false;
    } else if (existingBookmark?.parentId === folder.id) {
      label = t("‘{0}’에 저장되어 있어요", folder.title);
      enabled = false;
    } else {
      label = existingBookmark ? t("‘{0}’(으)로 옮기기", folder.title) : t("‘{0}’에 저장", folder.title);
    }
  } else {
    const name = elements.newFolderName.value.trim();
    const parent = parentPicker.selected;
    elements.newFolderPreview.textContent = parent && name ? `${parent.path} / ${name}` : "";
    if (!name) {
      label = t("새 폴더 이름을 입력하세요");
      enabled = false;
    } else if (!parent) {
      label = t("만들 위치를 선택하세요");
      enabled = false;
    } else {
      label = t("‘{0}’ 만들고 저장", name);
    }
  }
  elements.saveLabel.textContent = label;
  elements.save.disabled = !enabled;
  elements.savedBadge.hidden = !existingBookmark;
}

function highlightRecommendation() {
  elements.recommendations.querySelectorAll(".rec-row").forEach((row) => {
    row.setAttribute("aria-pressed", String(row.dataset.folderId === destinationPicker.value));
  });
}

function renderRecommendationMessage(message, { retry = false } = {}) {
  const box = document.createElement("div");
  box.className = "rec-empty";
  box.textContent = message;
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button";
    button.textContent = t("다시 시도");
    button.addEventListener("click", classify);
    box.append(button);
  }
  elements.recommendations.replaceChildren(box);
}

function renderNoMatch(result) {
  const box = document.createElement("div");
  box.className = "rec-nomatch";
  const title = document.createElement("strong");
  title.textContent = t("딱 맞는 폴더가 없어 보여요");
  const detail = document.createElement("p");
  detail.textContent = result.recommendation
    ? t("확신도 {0}%예요. 새 폴더에 두는 게 더 깔끔할까요?", Math.round((result.confidence || 0) * 100))
    : t("기존 폴더 중 어울리는 곳이 없어요. 새 폴더에 두는 게 더 깔끔해요.");
  const action = document.createElement("button");
  action.type = "button";
  action.className = "rec-nomatch-action";
  action.textContent = t("새 폴더 만들기 →");
  action.addEventListener("click", () => setMode("new"));
  box.append(title, detail, action);
  return box;
}

function renderRecommendations(result) {
  elements.recommendations.replaceChildren();
  const noMatch = shouldSuggestNewFolder(result, settings.confidenceThreshold);
  elements.recommendations.classList.toggle("is-nomatch", noMatch);
  if (noMatch) elements.recommendations.append(renderNoMatch(result));
  if (noMatch && result.candidates.length > 0) {
    const label = document.createElement("p");
    label.className = "rec-fallback-label";
    label.textContent = t("그래도 기존 폴더에 넣으려면");
    elements.recommendations.append(label);
  }

  const recommendedId = noMatch ? null : result.recommendation?.id;
  result.candidates.forEach((candidate, index) => {
    const title = folderTitle(candidate.id) || candidate.path;
    const percent = Math.round(candidate.probability * 100);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "rec-row";
    row.dataset.folderId = candidate.id;
    row.style.setProperty("--p", `${percent}%`);
    row.style.animationDelay = `${index * 60}ms`;

    const glyph = document.createElement("span");
    glyph.className = "folder-glyph";
    const copy = document.createElement("span");
    copy.className = "rec-copy";
    const name = document.createElement("strong");
    name.textContent = title;
    if (candidate.id === recommendedId) {
      const tag = document.createElement("em");
      tag.className = "rec-tag";
      tag.textContent = t("추천");
      name.append(tag);
    }
    const path = document.createElement("small");
    path.textContent = parentPath(candidate.path, title) || t("최상위");
    copy.append(name, path);
    const score = document.createElement("span");
    score.className = "rec-score";
    score.textContent = `${percent}%`;
    row.append(glyph, copy, score);
    row.addEventListener("click", () => {
      destinationPicker.setValue(candidate.id);
      highlightRecommendation();
      updateAction();
    });
    elements.recommendations.append(row);
  });

  if (!noMatch && result.candidates.length === 0) renderRecommendationMessage(t("맞는 기존 폴더를 찾지 못했어요."));
  highlightRecommendation();
}

function prepareNewFolder(result) {
  const confidencePercent = Math.round((result?.confidence || 0) * 100);
  elements.newFolderHint.hidden = !result;
  if (result) {
    elements.newFolderHint.textContent = result.recommendation
      ? t("추천 확신도 {0}% — 기준 {1}%보다 낮아 새 폴더를 제안해요.", confidencePercent, Math.round(settings.confidenceThreshold * 100))
      : t("기존 폴더 중 어울리는 곳이 없어 새 폴더를 제안해요.");
  }
  // Put the new folder next to the closest match, not inside it.
  const closest = result?.candidates[0] && findFolder(result.candidates[0].id);
  if (closest) parentPicker.setValue((closest.parent || closest.node).id);
  updateAction();
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

async function loadFolders() {
  folderTree = buildFolderTree(await chrome.bookmarks.getTree());
  folders = flattenFolderTree(folderTree);
  destinationPicker.setTree(folderTree);
  parentPicker.setTree(folderTree);
  destinationPicker.setDisabled(folders.length === 0);
  parentPicker.setDisabled(folders.length === 0);
  if (!parentPicker.value && folders[0]) parentPicker.setValue(folders[0].id);
}

async function upsertBookmark(parentId) {
  if (existingBookmark) {
    existingBookmark = await chrome.bookmarks.move(existingBookmark.id, { parentId });
  } else {
    existingBookmark = await chrome.bookmarks.create({
      parentId,
      title: activeTab.title || activeTab.url,
      url: activeTab.url,
    });
  }
}

async function saveToExisting({ automatic = false } = {}) {
  const folder = destinationPicker.selected;
  if (!folder) return;
  const moved = Boolean(existingBookmark);
  await upsertBookmark(folder.id);
  setStatus(
    automatic
      ? t("확신도가 높아 ‘{0}’에 자동 저장했어요.", folder.title)
      : moved
        ? t("‘{0}’(으)로 옮겼어요.", folder.path)
        : t("‘{0}’에 저장했어요.", folder.path),
    "success",
  );
}

async function createFolderAndSave() {
  const title = elements.newFolderName.value.trim();
  const parent = parentPicker.selected;
  if (!title || !parent) return;
  const children = await chrome.bookmarks.getChildren(parent.id);
  let folder = children.find(
    (item) => !item.url && item.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase(),
  );
  if (!folder) folder = await chrome.bookmarks.create({ parentId: parent.id, title });
  await upsertBookmark(folder.id);
  await loadFolders();
  destinationPicker.setValue(folder.id);
  elements.newFolderHint.hidden = true;
  setMode("existing");
  setStatus(t("‘{0} / {1}’ 폴더를 만들고 저장했어요.", parent.path, folder.title), "success");
}

async function save() {
  busy = true;
  updateAction();
  try {
    if (mode === "existing") await saveToExisting();
    else await createFolderAndSave();
  } catch (error) {
    setStatus(error.message || t("저장하지 못했어요."), "error");
  } finally {
    busy = false;
    updateAction();
  }
}

async function classify() {
  elements.classify.disabled = true;
  elements.recommendations.innerHTML = '<div class="skeleton"></div><div class="skeleton short"></div>';
  elements.recommendations.setAttribute("aria-busy", "true");
  try {
    const pageContext = await getPageContext();
    const response = await fetch(`${settings.endpoint.replace(/\/$/, "")}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: { title: activeTab.title, url: activeTab.url, description: pageContext.description },
        folders,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || t("서버 오류 ({0})", response.status));
    // 확신이 낮으면 기존 폴더를 미리 고르지 않아, 저장 버튼이 약한 추천으로 이어지지 않게 합니다.
    const noMatch = shouldSuggestNewFolder(result, settings.confidenceThreshold);
    if (result.recommendation && !existingBookmark && !noMatch) destinationPicker.setValue(result.recommendation.id);
    renderRecommendations(result);
    prepareNewFolder(noMatch ? result : null);
    if (result.truncatedFolderCount > 0) {
      setStatus(t("폴더가 많아 100개만 비교했어요. ({0}개 제외)", result.truncatedFolderCount));
    }
    if (
      settings.autoSave &&
      !existingBookmark &&
      result.recommendation &&
      result.confidence > settings.confidenceThreshold
    ) {
      await saveToExisting({ automatic: true });
    }
  } catch (error) {
    renderRecommendationMessage(t("추천을 받지 못했어요. {0}", error.message), { retry: true });
    setStatus(t("설정에서 백엔드 주소를 확인하세요."), "error");
  } finally {
    elements.classify.disabled = false;
    elements.recommendations.removeAttribute("aria-busy");
    updateAction();
  }
}

function renderPage() {
  elements.pageTitle.textContent = activeTab.title || t("제목 없는 페이지");
  try {
    const url = new URL(activeTab.url);
    elements.pageHost.textContent = url.hostname || activeTab.url;
    elements.siteLetter.textContent = (url.hostname.replace(/^www\./, "")[0] || "↗").toUpperCase();
  } catch {
    elements.pageHost.textContent = activeTab.url;
  }
  if (activeTab.favIconUrl?.startsWith("http")) {
    elements.siteFavicon.src = activeTab.favIconUrl;
    elements.siteFavicon.addEventListener("load", () => {
      elements.siteFavicon.hidden = false;
      elements.siteLetter.hidden = true;
    });
  }
}

async function initialize() {
  settings = { ...DEFAULT_SETTINGS, ...(await chrome.storage.sync.get(DEFAULT_SETTINGS)) };
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.url || !/^(https?|file|ftp):/.test(activeTab.url)) {
    elements.pageTitle.textContent = t("이 페이지는 저장할 수 없어요");
    elements.pageHost.textContent = t("일반 웹페이지에서 다시 열어 주세요.");
    renderRecommendationMessage(t("브라우저 내부 페이지는 북마크할 수 없어요."));
    activeTab = null;
    updateAction();
    return;
  }
  renderPage();
  await loadFolders();
  [existingBookmark] = await chrome.bookmarks.search({ url: activeTab.url });
  if (existingBookmark) {
    destinationPicker.setValue(existingBookmark.parentId);
    const current = folders.find((folder) => folder.id === existingBookmark.parentId);
    setStatus(current ? t("이미 ‘{0}’에 저장된 페이지예요.", current.path) : t("이미 저장된 페이지예요."));
  } else if (folders[0]) {
    destinationPicker.setValue(folders[0].id);
  }
  elements.newFolderName.value = suggestFolderName(activeTab);
  updateAction();

  if (folders.length === 0) {
    renderRecommendationMessage(t("먼저 Chrome에 북마크 폴더를 하나 만들어 주세요."));
    return;
  }
  if (settings.autoClassify) await classify();
  else {
    elements.classify.disabled = false;
    elements.classify.textContent = t("추천 받기");
    renderRecommendationMessage(t("‘추천 받기’를 누르면 어울리는 폴더를 찾아요."));
  }
}

elements.tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
document.querySelector(".mode-tabs").addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const next = mode === "existing" ? "new" : "existing";
  setMode(next);
  document.querySelector(`.mode-tab[data-mode="${next}"]`).focus();
});
elements.newFolderName.addEventListener("input", updateAction);
elements.newFolderName.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !elements.save.disabled) save();
});
elements.classify.addEventListener("click", classify);
elements.save.addEventListener("click", save);
$("#open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("#open-organizer").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("options.html#organize") });
});
document.body.dataset.mode = mode;
initialize().catch((error) => setStatus(error.message, "error"));
