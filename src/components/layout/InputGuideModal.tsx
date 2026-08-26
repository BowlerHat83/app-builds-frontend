import { useEffect, useState } from "react";

// Quick in-app reference for "where does each input on the intake form
// come from" - triggered from a button on the intake screen. Deliberately
// brief (source + one-line filename hint per file, not full click-by-click
// steps) since this is meant to be glanced at while sat in front of the
// export tool, not read top to bottom. The full walkthrough with numbered
// steps lives at the guide link in the footer for anyone who needs it.
const GUIDE_URL = "https://claude.ai/code/artifact/a44ebc13-dbf3-44e4-a3a1-18922669bd53";

interface FieldRef {
  name: string;
  required: boolean;
  note: string;
}

interface FileRef {
  slot: string;
  tool: string;
  export: string;
  feeds: string;
  match: string;
}

const FIELDS: FieldRef[] = [
  { name: "target_url", required: true, note: "The site being audited." },
  { name: "business_name", required: false, note: "Auto-detected from the target site if left blank." },
  { name: "target_location", required: false, note: "Auto-detected from the target site if left blank." },
];

const FILES: FileRef[] = [
  { slot: "screaming_frog_csv", tool: "Screaming Frog", export: "Internal > HTML export", feeds: "T2, T7", match: '"internal"+"html", "internal_all", or "screaming frog"' },
  { slot: "ahrefs_backlinks_csv", tool: "Ahrefs", export: "Backlinks report", feeds: "T3", match: '"backlink"' },
  { slot: "ahrefs_keywords_csv", tool: "Ahrefs", export: "Organic keywords report", feeds: "T3", match: '"organic keywords"' },
  { slot: "ahrefs_competitors_csv", tool: "Ahrefs", export: "Organic competitors report", feeds: "T3", match: '"orgcompetitors" / "competitor" (not "ppc")' },
  { slot: "ai_facts_csv", tool: "Waikay", export: "Fact Tracker export (Brand Name report)", feeds: "T4", match: '"facts"' },
  { slot: "ai_sources_csv", tool: "Waikay", export: "Source Tracker export (Knowledge Sources)", feeds: "T4", match: '"sources" / "knowledge sources"' },
  { slot: "ppc_keywords_csv", tool: "PPC research tool", export: "Keyword research export", feeds: "T5", match: '"ppc" + "keyword"' },
  { slot: "ppc_competitors_csv", tool: "PPC research tool", export: "Competitor overlap export", feeds: "T5", match: '"ppc" + "competitor"' },
  { slot: "brightlocal_csv", tool: "BrightLocal", export: "Citation Tracker export", feeds: "T6", match: '"citation tracker" / "brightlocal"' },
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
                ×
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
                <div className="guide-table-wrap">
                  <table className="guide-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Export</th>
                        <th>Feeds</th>
                        <th>Filename needs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FILES.map((f) => (
                        <tr key={f.slot}>
                          <td>{f.tool}</td>
                          <td>{f.export}</td>
                          <td>{f.feeds}</td>
                          <td><code>{f.match}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="guide-modal-foot">
              <span>Drop files in anywhere — each one auto-sorts into the right slot by filename.</span>
              <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer">
                Full step-by-step guide ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
