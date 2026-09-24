import assert from "node:assert/strict";
import test from "node:test";
import { nameProjects, normalizeProjectsRequest, parseProjectsResponse } from "./projects.mjs";

const cluster = {
  id: "c1",
  bookmarks: [
    { id: "1", title: "교토 숙소", url: "https://a.example" },
    { id: "2", title: "교토 맛집", url: "https://b.example" },
    { id: "3", title: "JR 패스", url: "https://c.example" },
    { id: "4", title: "React docs", url: "https://react.dev" },
  ],
};

test("normalizeProjectsRequest drops clusters that are too small", () => {
  assert.throws(() => normalizeProjectsRequest({ clusters: [{ id: "x", bookmarks: [{ id: "1", title: "a" }] }] }), TypeError);
  assert.equal(normalizeProjectsRequest({ clusters: [cluster] }).clusters[0].bookmarks.length, 4);
});

test("parseProjectsResponse keeps only real projects with known members", () => {
  const text = JSON.stringify({
    projects: [
      { clusterId: "c1", isProject: true, name: "교토 / 여행 준비", memberIds: ["1", "2", "3", "99"] },
      { clusterId: "c1", isProject: false, name: "잡동사니", memberIds: ["4"] },
      { clusterId: "nope", isProject: true, name: "모름", memberIds: ["1", "2", "3"] },
    ],
  });
  assert.deepEqual(parseProjectsResponse(text, [cluster]), [
    { clusterId: "c1", name: "교토 · 여행 준비", memberIds: ["1", "2", "3"] },
  ]);
});

test("parseProjectsResponse ignores projects with fewer than three members", () => {
  const text = '```json\n{"projects":[{"clusterId":"c1","isProject":true,"name":"둘뿐","memberIds":["1","2"]}]}\n```';
  assert.deepEqual(parseProjectsResponse(text, [cluster]), []);
});

test("nameProjects sends page metadata to the LLM", async () => {
  let prompt = "";
  const poe = {
    chat: async ({ messages }) => {
      prompt = messages[1].content;
      return {
        model: "test-model",
        content: JSON.stringify({ projects: [{ clusterId: "c1", isProject: true, name: "교토 여행", memberIds: ["1", "2", "3"] }] }),
      };
    },
  };
  const result = await nameProjects(poe, { clusters: [cluster] }, {
    metadataFetch: async (url) => ({ description: `desc for ${url}` }),
  });
  assert.match(prompt, /desc for https:\/\/a\.example/);
  assert.equal(result.projects[0].name, "교토 여행");
  assert.equal(result.model, "test-model");
});
