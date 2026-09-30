async function processMobileSaves() {
  const { mobileEndpoint, mobileToken } = await chrome.storage.local.get(["mobileEndpoint", "mobileToken"]);
  if (!mobileEndpoint || !mobileToken) return;
  const base = mobileEndpoint.replace(/\/$/, "");
  const headers = { Authorization: `Bearer ${mobileToken}` };
  const response = await fetch(`${base}/api/mobile/saves`, { headers });
  if (!response.ok) return;
  const { items = [] } = await response.json();
  for (const item of items) {
    try {
      const folders = await chrome.bookmarks.get(item.folderId);
      if (!folders[0] || folders[0].url) continue;
      const existing = (await chrome.bookmarks.search({ url: item.url }))[0];
      if (existing) await chrome.bookmarks.move(existing.id, { parentId: item.folderId });
      else await chrome.bookmarks.create({ parentId: item.folderId, title: item.title, url: item.url });
      await fetch(`${base}/api/mobile/saves/${item.id}/ack`, { method: "POST", headers });
    } catch (error) {
      console.warn("Mobile bookmark save failed", error);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => chrome.alarms.create("mobile-saves", { periodInMinutes: 1 }));
chrome.runtime.onStartup.addListener(() => chrome.alarms.create("mobile-saves", { periodInMinutes: 1 }));
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "mobile-saves") processMobileSaves().catch(console.warn);
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "process-mobile-saves") processMobileSaves().catch(console.warn);
});
