export interface BarDatum {
  label: string;
  value: number;
  sublabel?: string;
}

interface BarChartProps {
  data: BarDatum[];
  color?: string;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
}

export default function BarChart({ data, color = "var(--accent)", valueFormatter, emptyMessage = "No data available" }: BarChartProps) {
  if (!data.length) {
    return <div className="chart-empty">{emptyMessage}</div>;
  }
  const max = Math.max(...data.map((d) => d.value), 0.0001);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d, i) => {
        const pct = Math.max((d.value / max) * 100, d.value > 0 ? 1.5 : 0);
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(90px, 34%) 1fr", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.label}
              {d.sublabel && <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>{d.sublabel}</div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 9, borderRadius: 5, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 5,
                    background: color,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)", minWidth: 46, textAlign: "right" }}>
                {valueFormatter ? valueFormatter(d.value) : d.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
