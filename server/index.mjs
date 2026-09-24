import process from "node:process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import {
  classifyBookmark,
  classifyBookmarksBatch,
  normalizeBatchRequest,
  normalizeRequest,
} from "./classifier.mjs";
import { checkLinks, normalizeLinkRequest } from "./links.mjs";
import { createMetadataCache } from "./metadata-cache.mjs";
import { createPoeClient, DEFAULT_POE_MODEL, PoeError } from "./poe.mjs";
import {
  analyzeBookmarkProfile,
  enrichBookmarks,
  normalizeMetadataRequest,
  normalizeProfileRequest,
} from "./profile.mjs";
import { nameProjects, normalizeProjectsRequest } from "./projects.mjs";

// Load .env so `npm start` works without `make`. Variables already set in the
// shell take precedence over the file.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const port = Number.parseInt(process.env.PORT || "8787", 10);
const maxBodyBytes = 256 * 1024;
const maxProfileBodyBytes = 8 * 1024 * 1024;
const dataDir = path.resolve(process.env.DATA_DIR || "data");
const metadataCache = createMetadataCache(path.join(dataDir, "bookmarks-latest.json"));
const cachedMetadataFetch = async (url) => (await metadataCache.fetch(url)).meta;
const poeModel = () => process.env.POE_MODEL?.trim() || DEFAULT_POE_MODEL;

function setCorsHeaders(request, response) {
  const origin = request.headers.origin || "";
  if (origin.startsWith("chrome-extension://") || origin === "http://localhost:8787") {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request, limit = maxBodyBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new RangeError("요청이 너무 큽니다.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

let client;
function getClient() {
  if (!client) client = new TypeSafeClient();
  return client;
}

function sendError(response, fallbackMessage, error) {
  const isInputError = error instanceof TypeError || error instanceof SyntaxError;
  const isTooLarge = error instanceof RangeError;
  const isPoe = error instanceof PoeError;
  if (!isInputError && !isTooLarge) console.error(error);
  const status = isTooLarge ? 413 : isInputError ? 400 : isPoe && error.status === 503 ? 503 : 502;
  sendJson(response, status, {
    error: isInputError || isTooLarge || isPoe ? error.message : fallbackMessage,
  });
}

async function handle(response, fallbackMessage, work) {
  try {
    sendJson(response, 200, await work());
  } catch (error) {
    sendError(response, fallbackMessage, error);
  }
}

const server = createServer(async (request, response) => {
  setCorsHeaders(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      configured: Boolean(process.env.TYPESAFE_API_KEY),
      poeConfigured: Boolean(process.env.POE_API_KEY),
      poeModel: poeModel(),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/classify") {
    await handle(response, "분류 요청에 실패했습니다. 서버 로그와 API 키를 확인하세요.", async () => {
      const body = await readJson(request);
      // Validate before constructing the SDK client so malformed requests remain
      // distinguishable from missing credentials or upstream failures.
      normalizeRequest(body);
      return classifyBookmark(getClient(), body, {
        model: process.env.TYPESAFE_MODEL?.trim() || undefined,
      });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/classify-batch") {
    await handle(response, "일괄 분류 요청에 실패했습니다. 서버 로그와 API 키를 확인하세요.", async () => {
      const body = await readJson(request);
      normalizeBatchRequest(body);
      return classifyBookmarksBatch(getClient(), body, {
        model: process.env.TYPESAFE_MODEL?.trim() || undefined,
        metadataFetch: cachedMetadataFetch,
      });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/metadata") {
    let body;
    try {
      body = await readJson(request);
      normalizeMetadataRequest(body);
    } catch (error) {
      sendError(response, "페이지 메타정보를 읽지 못했습니다.", error);
      return;
    }
    if (body.stream !== true) {
      await handle(response, "페이지 메타정보를 읽지 못했습니다.", () =>
        enrichBookmarks(body, { cache: metadataCache }),
      );
      return;
    }
    // Stream one NDJSON line per bookmark as soon as its page is read.
    response.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    const writeLine = (line) => response.write(`${JSON.stringify(line)}\n`);
    try {
      const { cached } = await enrichBookmarks(body, {
        cache: metadataCache,
        onResult: (result, info) => writeLine({ type: "item", result, cached: info.cached }),
      });
      writeLine({ type: "done", cached });
    } catch (error) {
      console.error(error);
      writeLine({ type: "error", error: "페이지 메타정보를 읽지 못했습니다." });
    }
    response.end();
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/profile") {
    await handle(response, "관심사 분석에 실패했습니다. 서버 로그와 POE_API_KEY를 확인하세요.", async () => {
      const body = await readJson(request, maxProfileBodyBytes);
      normalizeProfileRequest(body);
      // Create the client lazily so the snapshot is saved even without POE_API_KEY.
      const poe = { chat: (args) => createPoeClient().chat(args) };
      return analyzeBookmarkProfile(poe, body, { model: poeModel(), dataDir });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/projects") {
    await handle(response, "프로젝트 묶음 분석에 실패했습니다. 서버 로그와 POE_API_KEY를 확인하세요.", async () => {
      const body = await readJson(request);
      normalizeProjectsRequest(body);
      const poe = { chat: (args) => createPoeClient().chat(args) };
      return nameProjects(poe, body, { model: poeModel(), metadataFetch: cachedMetadataFetch });
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/check-links") {
    await handle(response, "링크를 확인하지 못했습니다.", async () => {
      const body = await readJson(request);
      normalizeLinkRequest(body);
      return checkLinks(body);
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/profile/latest") {
    try {
      sendJson(response, 200, JSON.parse(await readFile(path.join(dataDir, "profile-latest.json"), "utf8")));
    } catch {
      sendJson(response, 404, { error: "아직 분석한 관심사 리포트가 없습니다." });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Tidymark server listening on http://127.0.0.1:${port}`);
});
