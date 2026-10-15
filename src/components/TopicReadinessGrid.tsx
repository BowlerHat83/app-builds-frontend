import type { TopicReadiness } from "../lib/topicReadiness";

interface TopicReadinessGridProps {
  readiness: TopicReadiness[];
}

// The 7 topic cards on intake screen 2. Green = every input for that topic
// is covered (uploaded CSV, API, or live check); amber = partly covered, or
// covered only by an estimate; grey = nothing yet.
function stateFor(t: TopicReadiness): "full" | "partial" | "empty" {
  if (t.totalCount === 0 || t.metCount === 0) return "empty";
  if (t.metCount === t.totalCount && !t.parts.some((p) => p.estimate)) return "full";
  return "partial";
}

const VIA_TAG: Record<string, string> = { csv: "CSV", api: "API", estimate: "Estimate", live: "Live" };

export default function TopicReadinessGrid({ readiness }: TopicReadinessGridProps) {
  return (
    <div className="readiness-grid readiness-grid-7">
      {readiness.map((t) => {
        const state = stateFor(t);
        const pct = t.totalCount ? Math.round((t.metCount / t.totalCount) * 100) : 0;
        return (
          <div key={t.key} className={`readiness-box readiness-${state}`}>
            <span className="readiness-box-label">{t.label}</span>
            <div className="readiness-box-bar">
              <div className="readiness-box-fill" style={{ width: `${pct}%` }} />
            </div>
            <ul className="readiness-parts">
              {t.parts.map((p) => (
                <li key={p.label} className={p.met ? "met" : "unmet"}>
                  <span className="readiness-tick">{p.met ? "✓" : "○"}</span>
                  <span>{p.label.replace(/ \((auto via API|Ahrefs estimate)\)$/, "")}</span>
                  {p.met && p.via && <span className={`readiness-via via-${p.via}`}>{VIA_TAG[p.via]}</span>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
