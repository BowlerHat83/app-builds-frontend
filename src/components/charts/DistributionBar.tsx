export interface DistributionSegment {
  label: string;
  value: number;
  color: string;
}

interface DistributionBarProps {
  segments: DistributionSegment[];
  showLegend?: boolean;
}

export default function DistributionBar({ segments, showLegend = true }: DistributionBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div style={{ display: "flex", height: 26, borderRadius: 7, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
        {total === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, color: "var(--text-tertiary)" }}>
            No data
          </div>
        ) : (
          segments.map((s, i) => {
            const pct = (s.value / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={i}
                title={`${s.label}: ${s.value}`}
                style={{
                  width: `${pct}%`,
                  background: s.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: "#04120d",
                  minWidth: pct > 6 ? undefined : 0,
                }}
              >
                {pct > 10 ? s.value : ""}
              </div>
            );
          })
        )}
      </div>
      {showLegend && (
        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
          {segments.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-secondary)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
              {s.label}: <b style={{ color: "var(--text-primary)" }}>{s.value}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
