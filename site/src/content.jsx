export const STORE_URL = "https://chromewebstore.google.com/detail/nglhhhkgognkifklfokjakljcopimcjg";

export const demoPages = [
  {
    id: "recipe",
    chip: "Weeknight lasagna",
    title: "Easy weeknight lasagna",
    host: "a food blog",
    color: "var(--amber)",
    recs: [
      { name: "Dinners", path: "Recipes", pct: 94 },
      { name: "Recipes", path: "Bookmarks bar", pct: 61 },
      { name: "Meal planning", path: "Home", pct: 22 },
    ],
  },
  {
    id: "shoes",
    chip: "Running shoes review",
    title: "The best running shoes of the year",
    host: "a gear review site",
    color: "var(--sky)",
    recs: [
      { name: "Running", path: "Fitness", pct: 87 },
      { name: "Wishlist", path: "Shopping", pct: 55 },
      { name: "Health", path: "Bookmarks bar", pct: 19 },
    ],
  },
  {
    id: "lisbon",
    chip: "3 days in Lisbon",
    title: "Lisbon in 3 days: an itinerary",
    host: "a travel magazine",
    color: "var(--lime)",
    noFit: { folder: "Lisbon", parent: "Travel" },
    recs: [{ name: "Travel", path: "Bookmarks bar", pct: 34 }],
  },
];

export const savePoints = [
  ["Your three best folders, with a confidence score", "Tap one to save. The button tells you exactly where the bookmark will land."],
  ["It won't force a bad fit", "When nothing scores high enough, it suggests a new folder, named after the site and placed next to the closest match."],
  ["No duplicates", "Already saved that address? Tidymark moves the existing bookmark instead of making a second one."],
  ["Auto-save if you want it", "Off by default. Turn it on and pages save themselves only when confidence clears your threshold."],
];

export const ways = [
  { tab: "A", color: "var(--lime)", soft: "var(--lime-soft)", title: "Into new folders",
    text: "Name the categories you want. Tidymark builds the structure and files each bookmark under it.",
    sample: "Tidymark\n├ Recipes\n├ Travel\n└ Home & Garden" },
  { tab: "B", color: "var(--sky)", soft: "var(--sky-soft)", title: "Into your folders",
    text: "Keep the structure you have. Strays go to the best match among up to 100 folders you choose.",
    sample: "→ Recipes / Baking\n→ Family / School" },
  { tab: "C", color: "var(--amber)", soft: "var(--amber-soft)", title: "By how you use them",
    text: "Split by the last time you opened each bookmark. Plain rules, no AI.",
    sample: "Active\nOccasional\nSomeday\nArchive" },
  { tab: "D", color: "var(--violet)", soft: "var(--violet-soft)", title: "Into projects",
    text: "Finds bursts of four or more bookmarks saved within hours of each other and groups them by purpose.",
    sample: "Projects\n└ 2026-04 · Kitchen remodel" },
];

export const buckets = [
  { name: "Active", rule: "opened in the last 30 days", count: 358 },
  { name: "Occasional", rule: "opened 30–180 days ago", count: 475 },
  { name: "Someday", rule: "saved, never opened", count: 252 },
  { name: "Archive", rule: "not opened in 180+ days", count: 353 },
];

export const checks = [
  { count: 37, title: "Broken links", text: "Pages that return 404 or 410, or whose domain is gone. Logins and temporary errors are left alone.", action: "Delete" },
  { count: 62, title: "Duplicates", text: "Same address, ignoring #, trailing slashes, www. and utm_ tags. Keeps the one that's filed or recently used.", action: "Delete" },
  { count: 11, title: "Empty folders", text: "Folders with nothing inside.", action: "Delete" },
  { count: 13, title: "Stale folders", text: "Not changed or opened in a period you pick, from 6 months to 5 years.", action: "Move to Archive", move: true },
];

export const movePlan = [
  { page: "One-bowl banana bread", to: "Recipes / Baking" },
  { page: "Toddler sleep schedule by age", to: "Family / Kids" },
  { page: "Standing desks compared", to: "Shopping / Home office" },
  { page: "Untitled", review: 41 },
];

export const SUPPORT_URL = "https://github.com/tangible-idea/JBO/issues";
export const PRIVACY_UPDATED = "September 25, 2026";

export const privacy = [
  ["Where classification happens", <>Tidymark sends pages to a Tidymark server for classification. By default that server runs on your own computer at <code>http://127.0.0.1:8787</code>. You can point the extension at a different HTTPS server in its settings, and Chrome asks for your permission before it can reach that address.</>],
  ["What is sent", "For each bookmark or page being classified: its title, address, and page description (or text you have selected on the page). For folder matching, the names of your folders. To read descriptions and check links, the server visits the bookmarked addresses."],
  ["The interest report", "When you run it, bookmark titles and descriptions are sent from the server to a large language model through the Poe API to produce the report. Nothing is sent unless you start the report."],
  ["Browsing history", "Optional, and only asked for when you turn it on in "sort by usage" mode. History is read inside your browser to decide how recently you used a page. It is never sent to any server."],
  ["What is stored", "Your settings live in Chrome's extension storage. The server keeps a cache of page titles and descriptions so it doesn't have to fetch them again."],
  ["What we don't do", "No accounts, no ads, no analytics, no selling or sharing of your data. Data is used only to organize your bookmarks."],
];
