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
