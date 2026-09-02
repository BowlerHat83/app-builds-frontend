import { useEffect, useState } from "react";
import { CSV_SOURCE_GUIDE } from "../../lib/csvSourceGuide";

// Quick in-app reference for "where does each input on the intake form
// come from" - triggered from a button on the intake screen. Grouped by
// source tool (Screaming Frog, Ahrefs, Waikay, SpyFu, BrightLocal), one
// card per CSV export within that group, each showing the filename hint
// next to the step-by-step path so it's usable while sat in front of the
// export tool rather than needing a separate walkthrough page. The full
// guide with screenshots still lives at the link in the footer.
const GUIDE_URL = "https://claude.ai/code/artifact/1fd34a08-2daf-4cf0-8f52-8c97e3ac094c";

interface FieldRef {
  name: string;
  required: boolean;
  note: string;
}

const FIELDS: FieldRef[] = [
  { name: "target_url", required: true, note: "The site being audited." },
  { name: "business_name", required: false, note: "Auto-detected from the target site if left blank." },
  { name: "target_location", required: false, note: "Auto-detected from the target site if left blank." },
  { name: "core_offering", required: false, note: "Drives Topic 6's map-pack keyword set. Leave blank to fall back to the old branded-keyword check." },
];

// Fixed display order + a short 2-letter badge for each source tool, since
// two of the five ("Screaming Frog" / "SpyFu") both start with S and would
// otherwise collide on a single-letter badge.
const TOOL_ORDER: { match: string; label: string; badge: string }[] = [
  { match: "Screaming Frog SEO Spider", label: "Screaming Frog", badge: "SF" },
  { match: "Ahrefs", label: "Ahrefs", badge: "AH" },
  { match: "Waikay", label: "Waikay", badge: "WK" },
  { match: "SpyFu", label: "SpyFu", badge: "SP" },
  { match: "BrightLocal", label: "BrightLocal", badge: "BL" },
];

export default function InputGuideModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const groups = TOOL_ORDER.map((t) => ({
    ...t,
    entries: CSV_SOURCE_GUIDE.filter((e) => e.tool === t.match),
  })).filter((g) => g.entries.length > 0);

  return (
    <>
      <button type="button" className="guide-trigger" onClick={() => setOpen(true)}>
        <span className="guide-trigger-icon">?</span>
        Where do these come from?
      </button>
      {open && (
        <div className="guide-overlay" onClick={() => setOpen(false)}>
          <div className="guide-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="guide-modal-head">
              <h2>Where each input comes from</h2>
              <button type="button" className="guide-close" onClick={() => setOpen(false)} aria-label="Close">
                x
              </button>
            </div>
            <div className="guide-modal-body">
              <div className="guide-block">
                <p className="guide-block-label">Text fields</p>
                <div className="guide-fields">
                  {FIELDS.map((f) => (
                    <div className="guide-field" key={f.name}>
                      <div className="guide-field-top">
                        <code>{f.name}</code>
                        <span className={`guide-badge ${f.required ? "required" : "optional"}`}>
                          {f.required ? "Required" : "Optional"}
                        </span>
                      </div>
                      <p>{f.note}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="guide-block">
                <p className="guide-block-label">CSV exports (none required)</p>
                <div className="guide-tool-groups">
                  {groups.map((g) => (
                    <div className="guide-tool-group" key={g.label}>
                      <div className="guide-tool-header">
                        <span className="guide-tool-badge">{g.badge}</span>
                        <span className="guide-tool-name">{g.label}</span>
                      </div>
                      {g.entries.map((e) => (
                        <div className="guide-source-card" key={e.key}>
                          <div className="guide-source-top">
                            <span className="guide-source-report">{e.reportName}</span>
                            {!e.confirmed && <span className="guide-badge optional">Unconfirmed</span>}
                          </div>
                          <div className="guide-source-cols">
                            <div className="guide-source-filename">
                              <p className="guide-source-col-label">Filename</p>
                              <code>{e.filenameHint}</code>
                            </div>
                            <div className="guide-source-path">
                              <p className="guide-source-col-label">Where to find it</p>
                              <ol>
                                {e.path.map((step, i) => (
                                  <li key={i}>{step}</li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="guide-modal-foot">
              <span>Drop files in anywhere - each one auto-sorts into the right slot by filename.</span>
              <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">
                Full step-by-step guide (opens in new tab)
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
