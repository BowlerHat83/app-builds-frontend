import { useRef } from "react";

export interface TabDef {
  key: string;
  label: string;
}

interface TopNavProps {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}

export default function TopNav({ tabs, active, onChange }: TopNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="tab-nav-wrap">
      <button className="tab-arrow" onClick={() => scrollBy(-220)} aria-label="Scroll tabs left">
        ‹
      </button>
      <div className="tab-nav-scroll" ref={scrollRef}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-pill ${active === tab.key ? "active" : ""}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <button className="tab-arrow" onClick={() => scrollBy(220)} aria-label="Scroll tabs right">
        ›
      </button>
    </div>
  );
}
