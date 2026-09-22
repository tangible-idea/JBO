import { choice } from "@typesafe-ai/sdk";

export const MAX_FOLDERS = 100;

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("요청 본문은 객체여야 합니다.");
  }

  const page = {
    title: cleanText(input.page?.title, 500),
    url: cleanText(input.page?.url, 2_000),
    description: cleanText(input.page?.description, 4_000),
  };

  if (!page.title && !page.url) {
    throw new TypeError("페이지 제목 또는 URL이 필요합니다.");
  }

  const seenIds = new Set();
  const folders = Array.isArray(input.folders)
    ? input.folders
        .map((folder) => ({
          id: cleanText(folder?.id, 200),
          path: cleanText(folder?.path, 500),
        }))
        .filter((folder) => {
          if (!folder.id || !folder.path || seenIds.has(folder.id)) return false;
          seenIds.add(folder.id);
          return true;
        })
        .slice(0, MAX_FOLDERS)
    : [];

  if (folders.length === 0) {
    throw new TypeError("분류할 북마크 폴더가 없습니다.");
  }

  return { page, folders };
}

export async function classifyBookmark(client, input, { model } = {}) {
  const { page, folders } = normalizeRequest(input);
  const criteria = Object.fromEntries(
    folders.map((folder, index) => [
      `folder_${index}`,
      `Save in the existing bookmark folder “${folder.path}”.`,
    ]),
  );
  criteria.no_good_match =
    "None of the existing folders is a reasonable semantic match for this page.";

  const request = {
    state: {
      page: {
        title: page.title || "(no title)",
        url: page.url || "(no URL)",
        description: page.description || "(no description available)",
      },
    },
    questions: {
      destination: choice(
        "Which existing bookmark folder is the best semantic destination for `page`? Prefer a specific folder when its path clearly fits. Choose no_good_match when every folder would be misleading.",
        criteria,
      ),
    },
  };
  if (model) request.model = model;

  const response = await client.systemOne(request);
  const answer = response.answers.destination;
  const candidates = Object.entries(answer.probabilities)
    .filter(([key]) => key !== "no_good_match" && /^folder_\d+$/.test(key))
    .map(([key, probability]) => {
      const folder = folders[Number(key.slice("folder_".length))];
      return folder ? { ...folder, probability } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.probability - a.probability);

  const selectedIndex = answer.choice.startsWith("folder_")
    ? Number(answer.choice.slice("folder_".length))
    : Number.NaN;
  const selected = Number.isInteger(selectedIndex) ? folders[selectedIndex] : null;

  return {
    recommendation: selected
      ? {
          ...selected,
          probability: answer.probabilities[answer.choice] ?? null,
        }
      : null,
    confidence: answer.confidence,
    candidates: candidates.slice(0, 3),
    noGoodMatchProbability: answer.probabilities.no_good_match ?? null,
    model: response.model,
    truncatedFolderCount: Math.max(0, input.folders.length - folders.length),
  };
}
