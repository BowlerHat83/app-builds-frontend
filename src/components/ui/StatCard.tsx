interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  muted?: boolean;
}

export default function StatCard({ label, value, sub, muted }: StatCardProps) {
  return (
    <div className="stat-card">
      <span className="stat-card-label">{label}</span>
      <span className={`stat-card-value ${muted ? "muted" : ""}`}>{value}</span>
      {sub && <span className="stat-card-sub">{sub}</span>}
    </div>
  );
}
