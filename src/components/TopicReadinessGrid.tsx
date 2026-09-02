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
    <div className="readiness-compact-grid">
      {readiness.map((t, i) => {
        const state = stateFor(t.metCount, t.totalCount);
        const tooltip = `${t.label}\n${t.parts.map((p) => `${p.met ? "✓" : "○"} ${p.label}`).join("\n")}`;
        return (
          <div key={t.key} className={`readiness-square readiness-${state}`} title={tooltip}>
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}
