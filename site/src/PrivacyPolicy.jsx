import Logo from "./components/Logo.jsx";
import { PRIVACY_UPDATED, SUPPORT_URL, privacy } from "./content.jsx";

const extra = [
  ["Who we are", "Tidymark is a Chrome extension that organizes your bookmarks. This policy covers the extension and the Tidymark classification server it talks to."],
  ["Permissions", "Tidymark asks for bookmarks (to read and organize them), activeTab and scripting (to read the title, address and description of the page you're on when you click the toolbar button), storage (for settings and undo), favicon (to show site icons), and, only if you turn it on, history. It does not read or change the content of other websites."],
  ["Children", "Tidymark is not directed at children under 13 and does not knowingly collect their data."],
  ["Changes to this policy", "If this policy changes, the new version will be posted on this page with a new date at the top."],
];

export default function PrivacyPolicy() {
  return (
    <>
      <header>
        <div className="wrap bar">
          <a className="brand" href="../">
            <Logo />
            Tidymark
          </a>
          <a className="btn ghost" href="../">
            Back to home
          </a>
        </div>
      </header>
      <main className="wrap policy">
        <p className="eyebrow">Privacy policy</p>
        <h1>What Tidymark does with your data.</h1>
        <p className="updated">Last updated {PRIVACY_UPDATED}</p>
        <p className="lede">
          Tidymark exists to organize your bookmarks. It uses your data for that and nothing else.
        </p>
        <dl>
          {[extra[0], ...privacy, ...extra.slice(1)].map(([term, detail]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
          <div>
            <dt>Contact</dt>
            <dd>
              Questions or requests about your data: open an issue at{" "}
              <a href={SUPPORT_URL} target="_blank" rel="noopener">
                {SUPPORT_URL.replace("https://", "")}
              </a>
              .
            </dd>
          </div>
        </dl>
      </main>
      <footer>
        <div className="wrap">
          <span>Tidymark · a bookmark organizer for Chrome</span>
          <a href="../">tidy.tmtt.link</a>
        </div>
      </footer>
    </>
  );
}
