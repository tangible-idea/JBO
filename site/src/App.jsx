import Logo from "./components/Logo.jsx";
import PopupDemo from "./components/PopupDemo.jsx";
import { PRIVACY_UPDATED, STORE_URL, buckets, checks, movePlan, privacy, savePoints, ways } from "./content.jsx";

const maxBucket = Math.max(...buckets.map((b) => b.count));

function StoreButton({ className = "btn" }) {
  return (
    <a className={className} href={STORE_URL} target="_blank" rel="noopener">
      Add to Chrome
    </a>
  );
}

function Header() {
  return (
    <header>
      <div className="wrap bar">
        <a className="brand" href="#top">
          <Logo />
          Tidymark
        </a>
        <nav aria-label="Sections">
          <a href="#save">Save a page</a>
          <a href="#tidy">Tidy everything</a>
          <a href="#checkup">Checkup</a>
          <a href="./privacypolicy/">Privacy</a>
        </nav>
        <StoreButton />
      </div>
    </header>
  );
}

function Hero() {
  return (
    <div className="wrap hero">
      <div>
        <p className="eyebrow">Bookmark organizer for Chrome</p>
        <h1 style={{ marginTop: 18 }}>
          You saved it <span className="count">for later.</span> Now where is it?
        </h1>
        <p className="lede">
          The recipe from last spring, the hotel you almost booked, the article you meant to finish. Tidymark reads
          each page and files it where it belongs, so you can find it again. Save the page you're on with one click,
          or sort years of loose bookmarks in one pass.
        </p>
        <div className="cta">
          <StoreButton />
          <a className="btn ghost" href="#tidy">
            See the four ways to tidy
          </a>
        </div>
        <p className="fine">Works with the folders you already have. Nothing moves until you press Apply.</p>
      </div>
      <PopupDemo />
    </div>
  );
}

function SectionHead({ eyebrow, title, children, flush }) {
  return (
    <div className="head" style={flush ? { margin: 0 } : undefined}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children && <p className="lede">{children}</p>}
    </div>
  );
}

function Save() {
  return (
    <section className="block" id="save">
      <div className="wrap split">
        <SectionHead eyebrow="In the toolbar" title="One click and it picks the folder." flush>
          Open the popup on any page. Tidymark reads the title, the address and the page description, then ranks your
          existing folders by how well they fit.
        </SectionHead>
        <ul className="points">
          {savePoints.map(([title, text]) => (
            <li key={title}>
              <b>{title}</b>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Ways() {
  return (
    <section className="block" id="tidy">
      <div className="wrap">
        <SectionHead eyebrow="Tidy studio" title="Four ways to sort the pile.">
          Pick a scope: only the loose bookmarks sitting outside any folder, everything, or one folder. Then pick how
          you want them sorted.
        </SectionHead>
        <div className="ways">
          {ways.map((way) => (
            <article className="way" key={way.tab} style={{ "--c": way.color, "--soft": way.soft }}>
              <span className="tab">{way.tab}</span>
              <div className="body">
                <h3>{way.title}</h3>
                <p>{way.text}</p>
                <pre>{way.sample}</pre>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Usage() {
  return (
    <section className="block" id="usage">
      <div className="wrap split">
        <div className="head" style={{ margin: 0 }}>
          <p className="eyebrow">Mode C in detail</p>
          <h2>Sorted by the day you last opened it.</h2>
          <p className="lede">
            Chrome remembers when you last used each bookmark. Tidymark turns that into four shelves. Anything saved in
            the last 14 days stays where it is.
          </p>
          <p className="fine">
            Optionally add the last 90 days of browsing history for better accuracy. History stays in your browser.
          </p>
        </div>
        <div className="buckets">
          {buckets.map((b) => (
            <div className="bucket" key={b.name} style={{ "--w": `${(b.count / maxBucket) * 63}%` }}>
              <span className="fill" />
              <div>
                <b>{b.name}</b>
                <small>{b.rule}</small>
              </div>
              <span className="n">{b.count}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Checkup() {
  return (
    <section className="block" id="checkup">
      <div className="wrap">
        <SectionHead eyebrow="Checkup" title="Find what to delete, and what to put away." />
        <div className="checks">
          {checks.map((c) => (
            <div className="check" key={c.title}>
              <span className="n">{c.count}</span>
              <b>{c.title}</b>
              <p>{c.text}</p>
              <span className={c.move ? "act move" : "act"}>{c.action}</span>
            </div>
          ))}
        </div>
        <p className="note">Numbers are from an example library. Deleted bookmarks come back if you undo.</p>
      </div>
    </section>
  );
}

function Interests() {
  return (
    <section className="block" id="interests">
      <div className="wrap split">
        <SectionHead eyebrow="Interest report" title="See what your bookmarks say about you." flush />
        <p className="lede" style={{ alignSelf: "end" }}>
          Maybe it's 30% cooking, 20% travel plans and a surprising amount of houseplants. Tidymark reads every
          bookmark's title and description, maps out the topics you care about and how much of your library each takes
          up, then proposes a folder structure to match. One click sends that structure to mode A.
        </p>
      </div>
    </section>
  );
}

function Safety() {
  const moves = movePlan.filter((m) => !m.review).length;
  return (
    <section className="block" style={{ borderTop: 0, paddingTop: 24 }}>
      <div className="wrap">
        <div className="safe">
          <div style={{ display: "grid", gap: 16 }}>
            <p className="eyebrow">Before anything moves</p>
            <h2>
              Nothing changes until you <em>apply</em>.
            </h2>
            <p style={{ color: "#d6d2c6" }}>
              You get a move plan grouped by destination. Change any row, untick what you don't like. Low-confidence
              rows are flagged for review and left unticked. And the last tidy can always be undone.
            </p>
          </div>
          <div className="plan" aria-label="Example move plan">
            {movePlan.map((m) => (
              <div className={m.review ? "row review" : "row"} key={m.page}>
                <span>{m.page}</span>
                <span className="to">{m.review ? `Review · ${m.review}%` : `→ ${m.to}`}</span>
              </div>
            ))}
            <div className="foot">
              <span>Apply {moves} moves</span>
              <span>Undo last tidy</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section className="block" id="privacy">
      <div className="wrap privacy">
        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <p className="eyebrow">Privacy</p>
          <h2 style={{ fontSize: 40 }}>What leaves your browser.</h2>
          <p className="updated">Last updated {PRIVACY_UPDATED}</p>
          <a className="policy-link" href="./privacypolicy/">Read the full privacy policy →</a>
        </div>
        <dl>
          {privacy.map(([term, detail]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Save />
        <Ways />
        <Usage />
        <Checkup />
        <Interests />
        <Safety />
        <Privacy />
      </main>
      <footer>
        <div className="wrap">
          <span>Tidymark · a bookmark organizer for Chrome</span>
          <span>For everyone who has ever saved something “for later”.</span>
        </div>
      </footer>
    </>
  );
}
