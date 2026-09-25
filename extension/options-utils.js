export function parseCategories(value, max = 24) {
  const seen = new Set();
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLocaleLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, max);
}

export function buildCategoryTree(categories) {
  const roots = [];
  for (const category of categories) {
    const parts = category.split(" / ").map((part) => part.trim()).filter(Boolean);
    let siblings = roots;
    let path = "";
    for (const part of parts) {
      path = path ? `${path} / ${part}` : part;
      let node = siblings.find((item) => item.name === part);
      if (!node) {
        node = { name: part, path, children: [] };
        siblings.push(node);
      }
      siblings = node.children;
    }
  }
  return roots;
}

export function chunkItems(items, size = 20) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function isBatchMoveEligible(result, threshold) {
  return Boolean(
    result?.category &&
    Number.isFinite(Number(result.confidence)) &&
    Number(result.confidence) > Number(threshold),
  );
}

export function collectBookmarks(nodes, parentPath = "") {
  const bookmarks = [];
  for (const node of nodes) {
    const path = node.title ? (parentPath ? `${parentPath} / ${node.title}` : node.title) : parentPath;
    if (node.url) {
      bookmarks.push({
        id: node.id,
        parentId: node.parentId,
        title: node.title,
        url: node.url,
        currentPath: parentPath,
        dateAdded: node.dateAdded,
        dateLastUsed: node.dateLastUsed,
        unmodifiable: Boolean(node.unmodifiable),
      });
    }
    if (node.children) bookmarks.push(...collectBookmarks(node.children, path));
  }
  return bookmarks;
}

export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

// Turns one classify-batch result into an editable plan row.
export function toPlanItem(bookmark, result, threshold) {
  const destination = result?.folder
    ? `folder:${result.folder.id}`
    : result?.category
      ? `category:${result.category}`
      : "";
  const alreadyThere = Boolean(result?.folder && result.folder.id === bookmark.parentId);
  const confident = isBatchMoveEligible({ category: destination, confidence: result?.confidence }, threshold);
  return {
    ...bookmark,
    destination,
    confidence: Number(result?.confidence) || 0,
    alreadyThere,
    needsReview: Boolean(destination) && !confident,
    checked: Boolean(destination) && confident && !alreadyThere,
  };
}

export function groupPlan(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.destination)) groups.set(item.destination, []);
    groups.get(item.destination).push(item);
  }
  return [...groups.entries()]
    .map(([destination, groupItems]) => ({ destination, items: groupItems }))
    .sort((a, b) => {
      if (!a.destination) return 1;
      if (!b.destination) return -1;
      return b.items.length - a.items.length;
    });
}
