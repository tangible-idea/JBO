const DEFAULT_SETTINGS = {
  endpoint: "http://127.0.0.1:8787",
  autoSave: false,
  confidenceThreshold: 0.78,
};

const endpoint = document.querySelector("#endpoint");
const autoSave = document.querySelector("#auto-save");
const threshold = document.querySelector("#threshold");
const status = document.querySelector("#status");

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
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
    if (thresholdValue < 0.5 || thresholdValue > 1) {
      throw new Error("confidence 기준은 0.50에서 1.00 사이여야 합니다.");
    }
    if (!(await ensureOriginPermission(endpointValue))) {
      throw new Error("해당 백엔드 주소에 접근 권한이 필요합니다.");
    }
    await chrome.storage.sync.set({
      endpoint: endpointValue,
      autoSave: autoSave.checked,
      confidenceThreshold: thresholdValue,
    });
    endpoint.value = endpointValue;
    setStatus("설정을 저장했습니다.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
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
}

document.querySelector("#save").addEventListener("click", saveSettings);
document.querySelector("#test").addEventListener("click", testConnection);
initialize();
