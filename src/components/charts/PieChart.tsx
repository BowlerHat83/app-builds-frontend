export interface PieDatum {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
}

interface PieChartProps {
  data: PieDatum[];
  size?: number;
  valueFormatter?: (value: number, total: number) => string;
  emptyMessage?: string;
  donut?: boolean;
  showLegend?: boolean;
}

const DEFAULT_COLORS = [
  "var(--accent)",
  "var(--accent-blue)",
  "var(--accent-amber)",
  "var(--accent-red)",
  "var(--accent-orange)",
  "var(--accent-yellow)",
  "#8b7cf6",
  "#f472b6",
  "#38bdf8",
  "#a3e635",
];

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function annulusPath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, endAngle);
  if (rInner <= 0) {
    return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
  }
  const p3 = polarToCartesian(cx, cy, rInner, endAngle);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

// Hand-written SVG donut/pie chart (no charting library, see README) - takes
// arbitrary label/value pairs, normalizes them to a full circle, and renders
// a legend alongside it since a bare slice of color rarely reads on its own.
export default function PieChart({
  data,
  size = 170,
  valueFormatter,
  emptyMessage = "No data available",
  donut = true,
  showLegend = true,
}: PieChartProps) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) {
    return <div className="chart-empty">{emptyMessage}</div>;
  }
  const total = filtered.reduce((sum, d) => sum + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = donut ? rOuter * 0.58 : 0;

  let cumulativeAngle = -Math.PI / 2;
  const segments = filtered.map((d, i) => {
    const fraction = d.value / total;
    const startAngle = cumulativeAngle;
    // A hairline gap keeps a 100%-share single segment from degenerating
    // into a zero-length arc path (start === end) instead of a full ring.
    const sweep = fraction * 2 * Math.PI * 0.999;
    const endAngle = startAngle + sweep;
    cumulativeAngle = startAngle + fraction * 2 * Math.PI;
    const color = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    return { ...d, color, fraction, path: annulusPath(cx, cy, rOuter, rInner, startAngle, endAngle) };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: "none" }}>
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="var(--card)" strokeWidth={1.5} />
        ))}
      </svg>
      {showLegend && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160, flex: 1 }}>
          {segments.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: "none" }} />
              <span
                style={{
                  flex: 1,
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.label}
                {s.sublabel && <span style={{ color: "var(--text-tertiary)" }}> · {s.sublabel}</span>}
              </span>
              <span style={{ fontWeight: 700, color: "var(--text-primary)", flex: "none" }}>
                {valueFormatter ? valueFormatter(s.value, total) : `${Math.round(s.fraction * 100)}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
