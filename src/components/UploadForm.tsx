import { useEffect, useRef, useState } from "react";
import type { AuditFormFields, AuditFormFiles } from "../api/client";
import type { MasterAuditResponse } from "../types/audit";
import { runMasterAudit, startAuditPrewarm } from "../api/client";
import { classifyFile, slotDef, SLOTS, SlotKey } from "../lib/fileClassifier";
import { computeTopicReadiness } from "../lib/topicReadiness";
import TopicReadinessGrid from "./TopicReadinessGrid";
import InputGuideModal from "./layout/InputGuideModal";

interface UnmatchedFile {
  id: string;
  file: File;
}

interface UploadFormProps {
  onResult: (result: MasterAuditResponse) => void;
}

// Minimum time Step 2's submit stays gated after Step 1 is submitted, so
// someone who already has every CSV ready and blitzes through Step 2 in a
// few seconds still gives the background pre-warm (WCAG, GDPR, GBP
// screenshot - see startAuditPrewarm) a head start before the final
// request goes out. This is a backstop, not the primary mechanism - most
// of the benefit comes from those checks running during the normal time it
// takes to browse for and upload files, not from this delay itself.
const PREWARM_GATE_SECONDS = 30;

export default function UploadForm({ onResult }: UploadFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [fields, setFields] = useState<AuditFormFields>({ target_url: "", business_name: "", target_location: "" });
  const [files, setFiles] = useState<AuditFormFiles>({});
  const [unmatched, setUnmatched] = useState<UnmatchedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Set once Step 1 is submitted. jobId is null if the prewarm call itself
  // failed (network hiccup, backend briefly asleep) - runMasterAudit works
  // exactly the same either way, just without the head start, and the
  // Step 2 gate below is skipped entirely when there's no job to wait on.
  const [jobId, setJobId] = useState<string | null>(null);
  const [prewarming, setPrewarming] = useState(false);
  const [readyAt, setReadyAt] = useState<number | null>(null);
  const [gateRemaining, setGateRemaining] = useState(0);

  useEffect(() => {
    if (step !== 2 || !jobId || readyAt === null) {
      setGateRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = PREWARM_GATE_SECONDS - Math.floor((Date.now() - readyAt) / 1000);
      setGateRemaining(Math.max(0, remaining));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, jobId, readyAt]);

  const updateField = (key: keyof AuditFormFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const assignFile = (key: SlotKey, file: File) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const removeFile = (key: SlotKey) => {
    setFiles((prev) => ({ ...prev, [key]: null }));
  };

  const ingestFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith(".csv"));
    const nextUnmatched: UnmatchedFile[] = [];
    incoming.forEach((file) => {
      const match = classifyFile(file.name);
      if (match) {
        assignFile(match, file);
      } else {
        nextUnmatched.push({ id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`, file });
      }
    });
    if (nextUnmatched.length) {
      setUnmatched((prev) => [...prev, ...nextUnmatched]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) ingestFiles(e.dataTransfer.files);
  };

  const handleBrowsePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) ingestFiles(e.target.files);
    e.target.value = "";
  };

  const assignUnmatched = (id: string, key: SlotKey) => {
    const item = unmatched.find((u) => u.id === id);
    if (!item) return;
    assignFile(key, item.file);
    setUnmatched((prev) => prev.filter((u) => u.id !== id));
  };

  const discardUnmatched = (id: string) => {
    setUnmatched((prev) => prev.filter((u) => u.id !== id));
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.target_url.trim()) {
      setError("Target URL is required.");
      return;
    }
    setError(null);
    setPrewarming(true);
    // Best-effort - startAuditPrewarm never throws, it resolves to null on
    // any failure. Either way we move on to Step 2 immediately.
    const jid = await startAuditPrewarm(fields);
    setJobId(jid);
    setReadyAt(Date.now());
    setPrewarming(false);
    setStep(2);
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setElapsedSeconds(0);
    try {
      const result = await runMasterAudit(fields, files, setElapsedSeconds, jobId);
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong running the audit.");
    } finally {
      setLoading(false);
    }
  };

  const readiness = computeTopicReadiness(fields, files);
  const filledSlots = SLOTS.filter((s) => files[s.key]);
  const gated = gateRemaining > 0;

  return (
    <div className="intake-wrap">
      <div className="card intake-card">
        <div className="intake-title-row">
          <h1 className="intake-title">Run a new SEO audit</h1>
          <InputGuideModal />
        </div>

        <div className="intake-steps">
          <span className={`intake-step ${step === 1 ? "active" : "done"}`}>
            <span className="intake-step-num">{step === 1 ? "1" : "✓"}</span>
            Site details
          </span>
          <span className="intake-step-divider" />
          <span className={`intake-step ${step === 2 ? "active" : ""}`}>
            <span className="intake-step-num">2</span>
            Upload exports
          </span>
        </div>

        {step === 1 ? (
          <>
            <p className="intake-sub">
              Start with the target site — submitting this kicks off a few of the slower checks (accessibility, cookie
              compliance, business profile) in the background while you gather your CSV exports on the next screen, so
              the full audit has less left to do once you submit it.
            </p>

            <form onSubmit={handleContinue}>
              <div className="intake-section">
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="target_url">Target URL *</label>
                    <input
                      id="target_url"
                      type="text"
                      placeholder="https://example.com"
                      value={fields.target_url}
                      onChange={(e) => updateField("target_url", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="business_name">Business name</label>
                    <input
                      id="business_name"
                      type="text"
                      placeholder="Auto-detected if left blank"
                      value={fields.business_name}
                      onChange={(e) => updateField("business_name", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="target_location">Location</label>
                    <input
                      id="target_location"
                      type="text"
                      placeholder="Auto-detected if left blank"
                      value={fields.target_location}
                      onChange={(e) => updateField("target_location", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="intake-section">
                {error && <div className="status-banner error">{error}</div>}
                <div className="intake-actions">
                  <button type="submit" className="btn btn-primary" disabled={prewarming}>
                    {prewarming && <span className="spinner" />}
                    {prewarming ? "Preparing…" : "Continue to file upload →"}
                  </button>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    Business name and location are optional — leave blank and each topic will auto-detect what it can.
                  </span>
                </div>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="intake-sub">
              Drop in whichever exports you have — files are matched to the right topic automatically by filename. Each
              topic reports honestly on what it couldn't compute from missing inputs.
            </p>
            <button type="button" className="link-btn intake-back" onClick={handleBack} disabled={loading}>
              ← Edit site details
            </button>

            <form onSubmit={handleSubmit}>
              <div className="intake-section">
                <p className="intake-section-label">Upload your exports</p>
                <div
                  className={`dropzone ${dragActive ? "drag-active" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <div className="dropzone-icon">📂</div>
                  <div className="dropzone-title">Drag &amp; drop your CSV exports here, or click to browse</div>
                  <div className="dropzone-sub">Screaming Frog, Ahrefs, AI-visibility, PPC and BrightLocal exports — drop as many at once as you like</div>
                  <input ref={fileInputRef} type="file" accept=".csv" multiple onChange={handleBrowsePick} />
                </div>

                {filledSlots.length > 0 && (
                  <div className="slot-chip-row">
                    {filledSlots.map((s) => (
                      <span key={s.key} className="slot-chip filled">
                        ✓ {s.label}
                        <button type="button" onClick={() => removeFile(s.key)} aria-label={`Remove ${s.label}`}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {unmatched.length > 0 && (
                  <div className="unmatched-list">
                    {unmatched.map((u) => (
                      <div key={u.id} className="unmatched-item">
                        <span className="filename">⚠ {u.file.name}</span>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) assignUnmatched(u.id, e.target.value as SlotKey);
                          }}
                        >
                          <option value="" disabled>
                            Assign to…
                          </option>
                          {SLOTS.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="link-btn" onClick={() => discardUnmatched(u.id)}>
                          Discard
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="intake-section">
                <p className="intake-section-label">Topic readiness</p>
                <TopicReadinessGrid readiness={readiness} />
              </div>

              <div className="intake-section">
                {error && <div className="status-banner error">{error}</div>}
                <div className="intake-actions">
                  <button type="submit" className="btn btn-primary" disabled={loading || gated}>
                    {loading && <span className="spinner" />}
                    {loading
                      ? `Running full audit… ${elapsedSeconds}s elapsed${elapsedSeconds > 60 ? " (live checks can take a few minutes on a cold backend)" : ""}`
                      : gated
                      ? `Preparing backend checks… ${gateRemaining}s`
                      : "Run full audit"}
                  </button>
                  <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                    {jobId
                      ? "Accessibility, cookie-compliance and profile checks have been running in the background since Step 1."
                      : "Usually finishes in a minute or two — can run longer the first time the backend wakes up from idle."}
                  </span>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
