// Chrome Web Store 배포 스크립트 (Chrome Web Store API v2).
// 사용법: node scripts/cws.mjs <package|status|upload|publish|release>
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const API = "https://chromewebstore.googleapis.com";
const PUBLISHER_ID = process.env.CWS_PUBLISHER_ID || "3b3bdeb2-dba1-4488-b44d-72afecefc090";
const ITEM_ID = process.env.CWS_ITEM_ID || "nglhhhkgognkifklfokjakljcopimcjg";

const manifest = JSON.parse(readFileSync(resolve(ROOT, "extension/manifest.json"), "utf8"));
const zipPath = resolve(ROOT, `dist/tidymark-${manifest.version}.zip`);
const itemPath = `/v2/publishers/${PUBLISHER_ID}/items/${ITEM_ID}`;

function buildZip() {
  mkdirSync(resolve(ROOT, "dist"), { recursive: true });
  rmSync(zipPath, { force: true });
  // manifest.json이 zip 루트에 있어야 하고, 테스트·macOS 메타파일은 제외합니다.
  execFileSync("zip", ["-r", "-X", "-q", zipPath, ".", "-x", "*.test.mjs", "*.DS_Store", "__MACOSX/*"], {
    cwd: resolve(ROOT, "extension"),
    stdio: "inherit",
  });
  console.log(`패키지: ${zipPath} (v${manifest.version})`);
}

async function accessToken() {
  const { CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN } = process.env;
  if (!CWS_CLIENT_ID || !CWS_CLIENT_SECRET || !CWS_REFRESH_TOKEN) {
    throw new Error(".env에 CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN을 설정하세요. docs/release-playbook.md 참고.");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: CWS_CLIENT_ID,
      client_secret: CWS_CLIENT_SECRET,
      refresh_token: CWS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`토큰 발급 실패: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function call(token, method, url, init = {}) {
  const res = await fetch(url, { method, ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${text}`);
  return body;
}

const status = (token) => call(token, "GET", `${API}${itemPath}:fetchStatus`);

async function upload(token) {
  let result = await call(token, "POST", `${API}/upload${itemPath}:upload`, {
    headers: { "Content-Type": "application/zip" },
    body: readFileSync(zipPath),
  });
  // 업로드 처리는 비동기일 수 있어 완료될 때까지 상태를 확인합니다.
  for (let i = 0; result.uploadState === "IN_PROGRESS" && i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    result = await status(token);
    result.uploadState = result.lastAsyncUploadState ?? result.uploadState;
  }
  console.log("업로드:", JSON.stringify(result, null, 2));
  if (result.uploadState && result.uploadState !== "SUCCEEDED") throw new Error("업로드가 성공하지 않았습니다.");
}

async function publish(token) {
  const result = await call(token, "POST", `${API}${itemPath}:publish`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  console.log("검토 제출:", JSON.stringify(result, null, 2));
}

const command = process.argv[2];
if (command === "package") buildZip();
else if (["status", "upload", "publish", "release"].includes(command)) {
  const token = await accessToken();
  if (command === "status") console.log(JSON.stringify(await status(token), null, 2));
  if (command === "upload" || command === "release") {
    buildZip();
    await upload(token);
  }
  if (command === "publish" || command === "release") await publish(token);
} else {
  console.error("사용법: node scripts/cws.mjs <package|status|upload|publish|release>");
  process.exit(1);
}
