import { t } from "./i18n.js";
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
  return title.slice(0, 80) || t("새 북마크 폴더");
}

export function buildFolderTree(nodes, parentPath = "") {
  const result = [];
  for (const node of nodes) {
    if (!node.children) continue;
    if (!node.title) {
      result.push(...buildFolderTree(node.children, parentPath));
      continue;
    }
    const path = parentPath ? `${parentPath} / ${node.title}` : node.title;
    result.push({ id: node.id, title: node.title, path, children: buildFolderTree(node.children, path) });
  }
  return result;
}

export function flattenFolderTree(tree) {
  return tree.flatMap((folder) => [{ id: folder.id, path: folder.path }, ...flattenFolderTree(folder.children)]);
}

// Keeps folders whose title matches, plus their ancestors so the match stays in context.
export function filterFolderTree(tree, query) {
  const needle = String(query || "").trim().toLocaleLowerCase();
  if (!needle) return tree;
  const result = [];
  for (const folder of tree) {
    const children = filterFolderTree(folder.children, needle);
    const matches = folder.title.toLocaleLowerCase().includes(needle);
    if (matches || children.length > 0) result.push({ ...folder, matches, children });
  }
  return result;
}
