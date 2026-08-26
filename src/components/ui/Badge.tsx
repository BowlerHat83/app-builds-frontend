type BadgeTone = "good" | "bad" | "warn" | "neutral";

interface BadgeProps {
  tone: BadgeTone;
  children: React.ReactNode;
  dot?: boolean;
}

export default function Badge({ tone, children, dot = true }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}
