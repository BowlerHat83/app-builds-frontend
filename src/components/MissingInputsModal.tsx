import { useEffect } from "react";
import type { MissingTopicInputs } from "../lib/topicReadiness";

interface MissingInputsModalProps {
  missing: MissingTopicInputs[];
  onProceed: () => void;
  onReturn: () => void;
}

// Shown the moment "Run full audit" is clicked if any topic's CSV inputs
// are incomplete - a last checkpoint before the audit locks in, since once
// it's running there's no way to add a file without starting over. Doesn't
// block anything itself; it just makes sure the gap is a choice, not a
// surprise discovered after the results come back.
export default function MissingInputsModal({ missing, onProceed, onReturn }: MissingInputsModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onReturn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReturn]);

  return (
    <div className="guide-overlay" onClick={onReturn}>
      <div className="guide-modal" role="dialog" aria-modal="true" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="guide-modal-head">
          <h2>Some exports are missing</h2>
          <button type="button" className="guide-close" onClick={onReturn} aria-label="Close">
            ×
          </button>
        </div>

        <div className="guide-modal-body">
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            The topics below are missing one or more CSV exports. They'll still run off whatever live checks are
            available, but will report limited or no data — and, being N/A rather than a 0, won't count toward the
            composite score.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {missing.map((topic) => (
              <div
                key={topic.key}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                  background: "var(--card-alt)",
                }}
              >
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "var(--text-primary)" }}>{topic.label}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-tertiary)" }}>
                  Missing: {topic.missingFiles.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="guide-modal-foot" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onReturn}>
            Return to inputs
          </button>
          <button type="button" className="btn btn-primary" onClick={onProceed}>
            Proceed to audit
          </button>
        </div>
      </div>
    </div>
  );
}
