import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile, readdir, stat, writeFile, rename, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const chromeRoot = () => process.env.MOBILE_CHROME_ROOT || path.join(os.homedir(), "Library/Application Support/Google/Chrome");
const fileRoots = () => [
  process.env.MOBILE_DOWNLOADS_ROOT || path.join(os.homedir(), "Downloads"),
  process.env.MOBILE_TIDY_ROOT || path.join(os.homedir(), "Documents/Tidymark"),
];
const queuePath = () => path.resolve(process.env.DATA_DIR || "data", "mobile-saves.json");

export function authorizedMobile(request) {
  const expected = process.env.MOBILE_TOKEN;
  if (!expected || expected.length < 24 || process.env.TIDYMARK_PUBLIC === "1") return false;
  const supplied = String(request.headers.authorization || "").replace(/^Bearer /i, "");
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function chromeCatalog() {
  const bookmarks = [];
  const folders = [];
  const profiles = await readdir(chromeRoot()).catch(() => []);
  for (const profile of profiles.filter((name) => name === "Default" || /^Profile \d+$/.test(name))) {
    let json;
    try { json = JSON.parse(await readFile(path.join(chromeRoot(), profile, "Bookmarks"), "utf8")); }
    catch { continue; }
    function walk(node, parts = [], root = false) {
      if (!node || typeof node !== "object") return;
      if (node.type === "url" && /^https?:\/\//i.test(node.url || "")) {
        bookmarks.push({ id: `${profile}:${node.id}`, title: node.name || node.url, url: node.url, path: parts.join(" / "), type: "bookmark" });
        return;
      }
      const next = root ? parts : [...parts, String(node.name || "")];
      if (!root && node.id && next.length > 0) folders.push({ id: String(node.id), path: next.join(" / "), profile });
      for (const child of node.children || []) walk(child, next);
    }
    for (const node of Object.values(json.roots || {})) walk(node, [], true);
  }
  return { bookmarks: bookmarks.slice(0, 20000), folders: folders.filter((f) => f.path).slice(0, 100) };
}

export async function fileCatalog() {
  const files = [];
  for (const root of fileRoots()) {
    const queue = [{ dir: root, depth: 0 }];
    while (queue.length && files.length < 10000) {
      const { dir, depth } = queue.shift();
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && depth < 5) queue.push({ dir: full, depth: depth + 1 });
        else if (entry.isFile()) {
          const info = await stat(full).catch(() => null);
          if (!info) continue;
          files.push({
            id: createHash("sha256").update(full).digest("hex"),
            title: entry.name,
            path: path.relative(root, full),
            collection: path.basename(root),
            size: info.size,
            modified: info.mtime.toISOString(),
            type: "file",
          });
        }
        if (files.length >= 10000) break;
      }
    }
  }
  return files;
}

async function readQueue() {
  try { return JSON.parse(await readFile(queuePath(), "utf8")); }
  catch { return []; }
}

async function saveQueue(queue) {
  await mkdir(path.dirname(queuePath()), { recursive: true });
  const temporary = `${queuePath()}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(queue));
  await rename(temporary, queuePath());
}

let mutation = Promise.resolve();
function mutate(fn) {
  const next = mutation.then(async () => {
    const queue = await readQueue();
    const result = fn(queue);
    await saveQueue(queue);
    return result;
  });
  mutation = next.catch(() => {});
  return next;
}

export async function queueBookmark(input) {
  const url = String(input?.url || "").trim();
  const title = String(input?.title || "").trim().slice(0, 500) || url;
  const folderId = String(input?.folderId || "");
  let parsed;
  try { parsed = new URL(url); } catch { /* handled below */ }
  if (!parsed || !["http:", "https:"].includes(parsed.protocol) || !parsed.hostname || url.length > 2000 || !folderId) {
    throw new TypeError("유효한 URL과 폴더가 필요합니다.");
  }
  const catalog = await chromeCatalog();
  if (!catalog.folders.some((folder) => folder.id === folderId && folder.profile === "Default")) {
    throw new TypeError("기본 Chrome 프로필의 폴더를 선택하세요.");
  }
  return mutate((queue) => {
    const duplicate = queue.find((item) => item.url === url && item.status === "pending");
    if (duplicate) {
      duplicate.folderId = folderId;
      duplicate.title = title;
      return duplicate;
    }
    const item = { id: randomUUID(), url, title, folderId, status: "pending", createdAt: new Date().toISOString() };
    queue.push(item);
    if (queue.length > 1000) queue.splice(0, queue.length - 1000);
    return item;
  });
}

export async function pendingBookmarks() {
  return (await readQueue()).filter((item) => item.status === "pending");
}

export async function acknowledgeBookmark(id) {
  return mutate((queue) => {
    const item = queue.find((entry) => entry.id === id && entry.status === "pending");
    if (!item) return false;
    item.status = "saved";
    item.savedAt = new Date().toISOString();
    return true;
  });
}
