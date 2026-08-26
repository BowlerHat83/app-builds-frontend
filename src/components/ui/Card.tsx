import type { PropsWithChildren, CSSProperties } from "react";

interface CardProps extends PropsWithChildren {
  title?: string;
  sectionLabel?: string;
  accent?: boolean;
  style?: CSSProperties;
  className?: string;
  right?: React.ReactNode;
}

export default function Card({ title, sectionLabel, accent, style, className, right, children }: CardProps) {
  return (
    <div className={`card ${accent ? "card-accent" : ""} ${className ?? ""}`} style={style}>
      {(title || sectionLabel || right) && (
        <div className="card-row" style={{ marginBottom: title || sectionLabel ? 16 : 0 }}>
          <div>
            {sectionLabel && <p className="section-label" style={{ marginBottom: title ? 4 : 0 }}>{sectionLabel}</p>}
            {title && <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
