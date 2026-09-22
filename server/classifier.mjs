import { choice } from "@typesafe-ai/sdk";

export const MAX_FOLDERS = 100;
export const MAX_BATCH_BOOKMARKS = 20;
export const MAX_BATCH_CATEGORIES = 24;

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

export function normalizeBatchRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("요청 본문은 객체여야 합니다.");
  }

  const seenCategories = new Set();
  const categories = Array.isArray(input.categories)
    ? input.categories
        .map((category) => cleanText(category, 120))
        .filter((category) => {
          const key = category.toLocaleLowerCase();
          if (!category || seenCategories.has(key)) return false;
          seenCategories.add(key);
          return true;
        })
        .slice(0, MAX_BATCH_CATEGORIES)
    : [];
  if (categories.length < 2) {
    throw new TypeError("일괄 정리 카테고리는 두 개 이상 필요합니다.");
  }

  const seenBookmarks = new Set();
  const bookmarks = Array.isArray(input.bookmarks)
    ? input.bookmarks
        .map((bookmark) => ({
          id: cleanText(bookmark?.id, 200),
          title: cleanText(bookmark?.title, 500),
          url: cleanText(bookmark?.url, 2_000),
          currentPath: cleanText(bookmark?.currentPath, 500),
        }))
        .filter((bookmark) => {
          if (!bookmark.id || (!bookmark.title && !bookmark.url) || seenBookmarks.has(bookmark.id)) {
            return false;
          }
          seenBookmarks.add(bookmark.id);
          return true;
        })
        .slice(0, MAX_BATCH_BOOKMARKS)
    : [];
  if (bookmarks.length === 0) {
    throw new TypeError("분류할 북마크가 없습니다.");
  }

  return { bookmarks, categories };
}

export async function classifyBookmarksBatch(client, input, { model } = {}) {
  const { bookmarks, categories } = normalizeBatchRequest(input);
  const criteria = Object.fromEntries(
    categories.map((category, index) => [
      `category_${index}`,
      `Organize this bookmark in the category “${category}”.`,
    ]),
  );
  criteria.no_good_match = "None of the proposed categories reasonably fits this bookmark.";

  const questions = Object.fromEntries(
    bookmarks.map((_, index) => [
      `bookmark_${index}`,
      choice(
        `Which proposed category best fits \`bookmarks[${index}]\`? Use its title, URL, and current folder as evidence. Choose no_good_match rather than forcing a misleading category.`,
        criteria,
      ),
    ]),
  );
  const request = { state: { bookmarks }, questions };
  if (model) request.model = model;

  const response = await client.systemOne(request);
  return {
    model: response.model,
    results: bookmarks.map((bookmark, index) => {
      const answer = response.answers[`bookmark_${index}`];
      const categoryIndex = answer.choice.startsWith("category_")
        ? Number(answer.choice.slice("category_".length))
        : Number.NaN;
      const category = Number.isInteger(categoryIndex) ? categories[categoryIndex] : null;
      return {
        ...bookmark,
        category,
        probability: category ? (answer.probabilities[answer.choice] ?? null) : null,
        confidence: answer.confidence,
        noGoodMatchProbability: answer.probabilities.no_good_match ?? null,
      };
    }),
  };
}
