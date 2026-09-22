export function shouldSuggestNewFolder(result, threshold) {
  if (!result?.recommendation) return true;
  const confidence = Number(result.confidence);
  const savedThreshold = Number(threshold);
  return (
    Number.isFinite(confidence) &&
    Number.isFinite(savedThreshold) &&
    confidence <= savedThreshold
  );
}

export function suggestFolderName(page) {
  try {
    const hostname = new URL(page?.url || "").hostname.toLowerCase();
    const parts = hostname.replace(/^www\./, "").split(".").filter(Boolean);
    const genericPrefixes = new Set(["app", "blog", "developer", "docs", "m"]);
    const usefulParts = parts.filter((part, index) => index > 0 || !genericPrefixes.has(part));
    const hasCountrySuffix = usefulParts.length >= 3 && usefulParts.at(-2)?.length === 2;
    const rawName = usefulParts.at(hasCountrySuffix ? -3 : -2) || usefulParts[0];
    const knownNames = {
      github: "GitHub",
      google: "Google",
      microsoft: "Microsoft",
      typescriptlang: "TypeScript",
      youtube: "YouTube",
    };
    if (rawName) {
      return (
        knownNames[rawName] ||
        rawName
          .split("-")
          .filter(Boolean)
          .map((part) => part[0]?.toUpperCase() + part.slice(1))
          .join(" ")
      );
    }
  } catch {
    // Fall back to a short part of the page title for non-HTTP URLs.
  }

  const title = String(page?.title || "").split(/\s[-–—|:]\s/)[0].trim();
  return title.slice(0, 80) || "새 북마크 폴더";
}
