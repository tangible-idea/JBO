import "node:process";
import { createServer } from "node:http";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import {
  classifyBookmark,
  classifyBookmarksBatch,
  normalizeBatchRequest,
  normalizeRequest,
} from "./classifier.mjs";

const port = Number.parseInt(process.env.PORT || "8787", 10);
const maxBodyBytes = 256 * 1024;

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

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new RangeError("요청이 너무 큽니다.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

let client;
function getClient() {
  if (!client) client = new TypeSafeClient();
  return client;
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
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/classify") {
    try {
      const body = await readJson(request);
      // Validate before constructing the SDK client so malformed requests remain
      // distinguishable from missing credentials or upstream failures.
      normalizeRequest(body);
      const result = await classifyBookmark(getClient(), body, {
        model: process.env.TYPESAFE_MODEL?.trim() || undefined,
      });
      sendJson(response, 200, result);
    } catch (error) {
      const isInputError = error instanceof TypeError || error instanceof SyntaxError;
      const isTooLarge = error instanceof RangeError;
      if (!isInputError && !isTooLarge) console.error(error);
      sendJson(response, isTooLarge ? 413 : isInputError ? 400 : 502, {
        error: isInputError || isTooLarge
          ? error.message
          : "JEV 분류 요청에 실패했습니다. 서버 로그와 API 키를 확인하세요.",
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/classify-batch") {
    try {
      const body = await readJson(request);
      normalizeBatchRequest(body);
      const result = await classifyBookmarksBatch(getClient(), body, {
        model: process.env.TYPESAFE_MODEL?.trim() || undefined,
      });
      sendJson(response, 200, result);
    } catch (error) {
      const isInputError = error instanceof TypeError || error instanceof SyntaxError;
      const isTooLarge = error instanceof RangeError;
      if (!isInputError && !isTooLarge) console.error(error);
      sendJson(response, isTooLarge ? 413 : isInputError ? 400 : 502, {
        error: isInputError || isTooLarge
          ? error.message
          : "JEV 일괄 분류 요청에 실패했습니다. 서버 로그와 API 키를 확인하세요.",
      });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`JEV bookmark server listening on http://127.0.0.1:${port}`);
});
