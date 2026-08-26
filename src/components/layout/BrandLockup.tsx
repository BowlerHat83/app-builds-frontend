import { BOWLER_HAT, ALLTRU } from "../../lib/brand";

// Went through a couple of shapes before this one:
//  1. Side-by-side logo chips fighting the product name for top billing.
//  2. Product name leading, both logos as a small "in collaboration with"
//     line stacked underneath it.
// Feedback on (2) was that the logos still didn't read as belonging on the
// left side of the header - a rough sketch asked for the logo lockup and
// the product name sitting as two peer blocks side by side, split by a
// vertical rule, rather than one stacked on top of the other. That's what
// this is: [logo chip + "in collaboration with" caption] | [SA mark +
// "SEO Audit Dashboard"].
export default function BrandLockup() {
  return (
    <div className="header-lockup">
      <div className="collab-block">
        <div className="collab-lockup">
          <img src={BOWLER_HAT.logoUrl} alt={BOWLER_HAT.name} className="collab-logo collab-logo-bowlerhat" />
          <span className="collab-divider" />
          <img src={ALLTRU.logoUrl} alt={ALLTRU.name} className="collab-logo collab-logo-alltru" />
        </div>
        <span className="collab-label">IN COLLABORATION WITH</span>
      </div>
      <span className="header-lockup-divider" />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="brand-mark">SA</span>
        <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
          SEO Audit Dashboard
        </span>
      </div>
    </div>
  );
}
