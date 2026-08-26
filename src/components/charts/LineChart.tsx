export interface LinePoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LinePoint[];
  color?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  emptyMessage?: string;
}

const WIDTH = 640;

export default function LineChart({ data, color = "var(--accent)", height = 200, valueFormatter, emptyMessage = "No data available" }: LineChartProps) {
  if (!data.length) {
    return <div className="chart-empty">{emptyMessage}</div>;
  }

  const padding = { top: 16, right: 16, bottom: 26, left: 8 };
  const innerW = WIDTH - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = padding.top + innerH - ((d.value - min) / range) * innerH;
    return { x, y, d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${padding.top + innerH} L${points[0].x.toFixed(1)},${padding.top + innerH} Z`;

  const labelStride = Math.ceil(data.length / 8);

  // The SVG's viewBox has a fixed internal aspect ratio (WIDTH:height). The
  // wrapper below is given that same aspect ratio via CSS so the browser
  // never has to stretch the viewBox non-uniformly to fill it - that
  // non-uniform stretch (previously done with preserveAspectRatio="none")
  // is what made this chart look distorted/stretched on a wide card.
  return (
    <div style={{ width: "100%", aspectRatio: `${WIDTH} / ${height}`, maxHeight: height }}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#lineFill)" stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
      ))}
      {points.map((p, i) =>
        i % labelStride === 0 ? (
          <text key={`lbl-${i}`} x={p.x} y={height - 6} fontSize={10} fill="var(--text-tertiary)" textAnchor="middle">
            {p.d.label}
          </text>
        ) : null
      )}
      {points.map((p, i) =>
        i === points.length - 1 || i === 0 ? (
          <text key={`val-${i}`} x={p.x} y={p.y - 10} fontSize={10.5} fontWeight={700} fill="var(--text-primary)" textAnchor="middle">
            {valueFormatter ? valueFormatter(p.d.value) : p.d.value}
          </text>
        ) : null
      )}
      </svg>
    </div>
  );
}
