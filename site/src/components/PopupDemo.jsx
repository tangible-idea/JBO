import { useState } from "react";
import { demoPages } from "../content.jsx";

function Rec({ rec, top }) {
  return (
    <div className={top ? "rec top" : "rec"}>
      <span className="folder" />
      <span className="name">
        <b>{rec.name}</b>
        {top && <span className="tag">Best</span>}
        <small>{rec.path}</small>
      </span>
      <span className="pct">{rec.pct}%</span>
      <span className="meter" style={{ "--w": `${rec.pct}%` }} />
    </div>
  );
}

export default function PopupDemo() {
  const [active, setActive] = useState(0);
  const page = demoPages[active];

  return (
    <div className="demo" aria-label="Example of the Tidymark popup">
      <div className="pages" role="group" aria-label="Try an example page">
        {demoPages.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className="chip"
            aria-pressed={i === active}
            style={{ "--c": p.color }}
            onClick={() => setActive(i)}
          >
            <i />
            {p.chip}
          </button>
        ))}
      </div>

      {/* key remounts the popup so the confidence meters replay on each switch */}
      <div className="popup" aria-live="polite" key={page.id}>
        <div className="page" style={{ "--c": page.color }}>
          <span className="fav" />
          <div>
            <b>{page.title}</b>
            <small>{page.host}</small>
          </div>
        </div>

        {page.noFit ? (
          <>
            <div className="nofit">
              <b>No folder fits well</b>
              <p>The closest folder scores {page.recs[0].pct}%. A new folder is the cleaner choice.</p>
              <span className="btn">
                Create “{page.noFit.folder}” in {page.noFit.parent} →
              </span>
            </div>
            <p className="eyebrow label">Or save to an existing folder</p>
            <div className="recs">
              <Rec rec={page.recs[0]} />
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow label">Suggested folders</p>
            <div className="recs">
              {page.recs.map((rec, i) => (
                <Rec key={rec.name} rec={rec} top={i === 0} />
              ))}
            </div>
            <span className="btn save">Save to “{page.recs[0].name}”</span>
          </>
        )}
      </div>
    </div>
  );
}
