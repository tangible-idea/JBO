// Minimal client for Poe's OpenAI-compatible Chat Completions API.
// https://creator.poe.com/docs/external-applications/openai-compatible-api

export const POE_BASE_URL = "https://api.poe.com/v1";
export const DEFAULT_POE_MODEL = "Claude-Sonnet-4.6";
const REQUEST_TIMEOUT_MS = 180_000;

export class PoeError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "PoeError";
    this.status = status;
  }
}

export function createPoeClient({ apiKey = process.env.POE_API_KEY, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new PoeError("POE_API_KEY가 설정되지 않았습니다.", 503);
  return {
    async chat({ model, messages, maxTokens = 4_000, temperature = 0.3 }) {
      const response = await fetchImpl(`${POE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = body?.error?.message || `HTTP ${response.status}`;
        throw new PoeError(`Poe API 오류: ${detail}`, response.status);
      }
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new PoeError("Poe API가 빈 응답을 반환했습니다.", 502);
      }
      // A cut-off answer is broken JSON; say so instead of failing to parse it later.
      if (body.choices[0].finish_reason === "length") {
        throw new PoeError(`LLM 응답이 길이 한도(${maxTokens} 토큰)에서 잘렸습니다.`, 502);
      }
      return { content, model: body.model || model, usage: body.usage || null };
    },
  };
}
