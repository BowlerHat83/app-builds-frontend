interface GaugeRingProps {
  value: number | null; // 0-100, drives how much of the ring is filled
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  displayValue?: string; // overrides the centered text (defaults to `${value}`)
  unit?: string;
  small?: boolean;
  // When true, renders an animated spinning ring at the same size instead
  // of the value-driven gauge - used on the Overview cards while a topic is
  // still running, so the reader can see at a glance what's still loading
  // rather than a static "0%"/"–" gauge that looks finished.
  loading?: boolean;
}

export default function GaugeRing({
  value,
  size = 90,
  strokeWidth = 8,
  color = "var(--accent)",
  trackColor = "rgba(255,255,255,0.08)",
  displayValue,
  unit,
  small,
  loading,
}: GaugeRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference - (pct / 100) * circumference;
  const center = size / 2;

  if (loading) {
    // A quarter-circle arc that spins continuously around the track -
    // same footprint as the finished gauge so the card layout doesn't
    // shift once the real score arrives.
    const arcLength = circumference * 0.25;
    return (
      <div className="gauge-wrap" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="gauge-spinner-svg">
          <circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeLinecap="round"
            className="gauge-spinner-arc"
          />
        </svg>
        <div className="gauge-center">
          <span className={`gauge-value ${small ? "small" : ""}`}>…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gauge-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {value !== null && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="gauge-center">
        <span className={`gauge-value ${small ? "small" : ""}`}>{displayValue ?? (value === null ? "–" : Math.round(value))}</span>
        {unit && <span className="gauge-unit">{unit}</span>}
      </div>
    </div>
  );
}
