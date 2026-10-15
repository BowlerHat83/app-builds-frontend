import type { Envelope, SourceItem, ExtraItem } from "../types/audit";

// Shown at the top of every topic tab instead of warning banners: which data
// sources fed this topic on this audit run, which optional inputs/features
// were (or weren't) part of it, and - only if something genuinely went wrong
// - a short notes list. Routine things like a CSV not being uploaded or a
// screenshot being switched off live under "Additional inputs & features".

const KIND_LABEL: Record<SourceItem["kind"], string> = {
  csv: "CSV upload",
  api: "API",
  live: "Live check",
  estimate: "Estimate",
};

const STATE_ICON: Record<ExtraItem["state"], string> = {
  included: "✓",
  missing: "○",
  off: "–",
  unavailable: "!",
};

const STATE_LABEL: Record<ExtraItem["state"], string> = {
  included: "Included",
  missing: "Not provided",
  off: "Not enabled",
  unavailable: "Unavailable",
};

export default function SourcesPanel({ envelope }: { envelope: Envelope<unknown> }) {
  const sources = envelope.sources ?? [];
  const extras = envelope.extras ?? [];
  const notes = envelope.warnings ?? [];
  if (!sources.length && !extras.length && !notes.length) return null;

  return (
    <div className="card sources-panel">
      <div className="sources-cols">
        <div className="sources-col">
          <p className="sources-heading">Sources used</p>
          {sources.length ? (
            <ul className="sources-list">
              {sources.map((s) => (
                <li key={s.name} className="sources-item">
                  <span className={`source-kind kind-${s.kind}`}>{KIND_LABEL[s.kind] ?? s.kind}</span>
                  <span className="source-text">
                    <strong>{s.name}</strong>
                    {s.detail && <span className="source-detail">{s.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="source-detail">No data sources were available for this topic on this run.</p>
          )}
        </div>

        {extras.length > 0 && (
          <div className="sources-col">
            <p className="sources-heading">Additional inputs &amp; features</p>
            <ul className="sources-list">
              {extras.map((e) => (
                <li key={e.name} className="sources-item" title={e.detail}>
                  <span className={`extra-state state-${e.state}`} aria-label={STATE_LABEL[e.state]}>
                    {STATE_ICON[e.state] ?? "•"}
                  </span>
                  <span className="source-text">
                    <strong>{e.name}</strong> <span className="extra-label">· {STATE_LABEL[e.state] ?? e.state}</span>
                    {e.detail && <span className="source-detail">{e.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {notes.length > 0 && (
        <div className="sources-notes">
          <p className="sources-heading">Notes</p>
          <ul>
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
