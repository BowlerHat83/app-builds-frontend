import type { TopicReadiness } from "../lib/topicReadiness";

interface TopicReadinessGridProps {
  readiness: TopicReadiness[];
}

function stateFor(metCount: number, totalCount: number): "full" | "partial" | "empty" {
  if (totalCount === 0 || metCount === 0) return "empty";
  if (metCount === totalCount) return "full";
  return "partial";
}

export default function TopicReadinessGrid({ readiness }: TopicReadinessGridProps) {
  return (
    <div className="readiness-grid">
      {readiness.map((t) => {
        const state = stateFor(t.metCount, t.totalCount);
        const pct = t.totalCount ? (t.metCount / t.totalCount) * 100 : 0;
        return (
          <div key={t.key} className={`readiness-box readiness-${state}`} title={t.parts.map((p) => `${p.met ? "✓" : "○"} ${p.label}`).join("\n")}>
            <div className="readiness-box-bar">
              <div className="readiness-box-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="readiness-box-label">{t.label}</span>
            <span className="readiness-box-count">
              {t.metCount}/{t.totalCount} ready
            </span>
          </div>
        );
      })}
    </div>
  );
}
