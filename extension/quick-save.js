// Cmd+D (or the address-bar star) makes Chrome create a bookmark on its own.
// Tidymark notices that bookmark and opens its popup so it can be filed in one click.
// Loaded into the service worker with importScripts (classic script).

const SELF_CREATED_KEY = "selfCreated";
const JUST_BOOKMARKED_KEY = "justBookmarked";
let importing = false;

// Tidymark's own saves (popup, studio undo, mobile sync) mark the URL first so they are not mistaken for Cmd+D.
async function markSelfCreated(url) {
  const { [SELF_CREATED_KEY]: marks = {} } = await chrome.storage.session.get(SELF_CREATED_KEY);
  const now = Date.now();
  for (const [key, until] of Object.entries(marks)) if (until < now) delete marks[key];
  marks[url] = now + 10_000;
  await chrome.storage.session.set({ [SELF_CREATED_KEY]: marks });
}

async function isSelfCreated(url) {
  const { [SELF_CREATED_KEY]: marks = {} } = await chrome.storage.session.get(SELF_CREATED_KEY);
  return (marks[url] ?? 0) > Date.now();
}

chrome.bookmarks.onImportBegan.addListener(() => { importing = true; });
chrome.bookmarks.onImportEnded.addListener(() => { importing = false; });

chrome.bookmarks.onCreated.addListener(async (id, node) => {
  if (!node.url || importing) return;
  // Bookmarks arriving through Chrome Sync keep their original (older) creation time.
  if (node.dateAdded && Date.now() - node.dateAdded > 5_000) return;
  if (await isSelfCreated(node.url)) return;
  const { quickSaveAssist = true } = await chrome.storage.sync.get("quickSaveAssist");
  if (!quickSaveAssist) return;

  await chrome.storage.session.set({ [JUST_BOOKMARKED_KEY]: { id, title: node.title, url: node.url, at: Date.now() } });
  try {
    await chrome.action.openPopup();
  } catch {
    // Older Chrome or no focused window: leave a nudge on the toolbar icon instead.
    await chrome.action.setBadgeBackgroundColor({ color: "#c8f25a" });
    await chrome.action.setBadgeTextColor?.({ color: "#18181a" });
    await chrome.action.setBadgeText({ text: "1" });
  }
});
