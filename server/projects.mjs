import { fetchBookmarkMetadata } from "./metadata.mjs";

export const MAX_PROJECT_CLUSTERS = 12;
export const MAX_CLUSTER_BOOKMARKS = 40;

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeProjectsRequest(input) {
  const seenClusters = new Set();
  const clusters = (Array.isArray(input?.clusters) ? input.clusters : [])
    .map((cluster) => {
      const seen = new Set();
      return {
        id: cleanText(cluster?.id, 100),
        bookmarks: (Array.isArray(cluster?.bookmarks) ? cluster.bookmarks : [])
          .map((bookmark) => ({
            id: cleanText(bookmark?.id, 200),
            title: cleanText(bookmark?.title, 300),
            url: cleanText(bookmark?.url, 2_000),
            folder: cleanText(bookmark?.folder, 300),
          }))
          .filter((bookmark) => bookmark.id && (bookmark.title || bookmark.url) && !seen.has(bookmark.id) && seen.add(bookmark.id))
          .slice(0, MAX_CLUSTER_BOOKMARKS),
      };
    })
    .filter((cluster) => cluster.id && cluster.bookmarks.length >= 2 && !seenClusters.has(cluster.id) && seenClusters.add(cluster.id))
    .slice(0, MAX_PROJECT_CLUSTERS);
  if (clusters.length === 0) throw new TypeError("묶음 후보가 없습니다.");
  return { clusters };
}

export function buildProjectMessages(clusters) {
  const blocks = clusters.map((cluster) => {
    const lines = cluster.bookmarks.map((bookmark) =>
      JSON.stringify([
        bookmark.id,
        bookmark.title || bookmark.meta?.pageTitle || bookmark.url,
        hostOf(bookmark.url),
        cleanText(bookmark.meta?.description, 140),
      ]),
    );
    return `<cluster id="${cluster.id}">\n${lines.join("\n")}\n</cluster>`;
  });
  const system = [
    "You study browser bookmarks that a person saved in a short burst of time.",
    "Decide whether each burst was one real-world purpose (a trip, a job search, researching a library, a purchase) and name it.",
    "Respond with a single JSON object and nothing else.",
  ].join(" ");
  const user = `아래 cluster들은 각각 짧은 기간에 몰아서 저장한 북마크입니다. 각 줄은 [id, 제목, 도메인, 설명] 입니다.

${blocks.join("\n\n")}

다음 스키마의 JSON만 출력하세요.
{
  "projects": [
    { "clusterId": "cluster id", "isProject": true, "name": "프로젝트 이름", "memberIds": ["같은 목적에 속하는 북마크 id"] }
  ]
}

규칙:
- 모든 cluster에 대해 한 항목씩 답합니다.
- 하나의 구체적인 목적으로 묶이는 북마크가 3개 이상일 때만 isProject를 true로 합니다. 주제가 제각각이면 false.
- memberIds에는 그 목적에 속하는 북마크만 넣고, 우연히 같은 시기에 저장된 북마크는 뺍니다.
- name은 북마크 제목에 주로 쓰인 언어로, 25자 이내로 구체적으로 씁니다. 예: "교토 여행 준비", "React Native migration". "/" 문자는 쓰지 않습니다.`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function extractJson(text) {
  const unfenced = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("LLM 응답에서 JSON을 찾지 못했습니다.");
  return JSON.parse(unfenced.slice(start, end + 1));
}

export function parseProjectsResponse(text, clusters) {
  const raw = extractJson(text);
  const byId = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const projects = [];
  for (const item of Array.isArray(raw.projects) ? raw.projects : []) {
    const cluster = byId.get(cleanText(item?.clusterId, 100));
    if (!cluster || item?.isProject !== true) continue;
    const allowed = new Set(cluster.bookmarks.map((bookmark) => bookmark.id));
    const memberIds = [...new Set((Array.isArray(item.memberIds) ? item.memberIds : []).map(String))]
      .filter((id) => allowed.has(id));
    const name = cleanText(String(item.name ?? "").replaceAll("/", "·"), 40);
    if (name && memberIds.length >= 3) projects.push({ clusterId: cluster.id, name, memberIds });
  }
  return projects;
}

export async function nameProjects(poe, input, { model, metadataFetch = fetchBookmarkMetadata } = {}) {
  const { clusters } = normalizeProjectsRequest(input);
  const enriched = await Promise.all(
    clusters.map(async (cluster) => ({
      ...cluster,
      bookmarks: await Promise.all(
        cluster.bookmarks.map(async (bookmark) => ({ ...bookmark, meta: await metadataFetch(bookmark.url) })),
      ),
    })),
  );
  const answer = await poe.chat({ model, messages: buildProjectMessages(enriched), maxTokens: 3_000 });
  return { model: answer.model, projects: parseProjectsResponse(answer.content, clusters) };
}
