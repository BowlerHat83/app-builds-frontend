import { useRef, useState } from "react";
import type { AuditFormFields, AuditFormFiles } from "../api/client";
import type { MasterAuditResponse } from "../types/audit";
import { startAuditJob } from "../api/client";
import { classifyFile, slotDef, SLOTS, SlotKey } from "../lib/fileClassifier";
import { computeTopicReadiness, computeMissingFileInputs } from "../lib/topicReadiness";
import TopicReadinessGrid from "./TopicReadinessGrid";
import InputGuideModal from "./layout/InputGuideModal";
import MissingInputsModal from "./MissingInputsModal";

interface UnmatchedFile {
  id: string;
  file: File;
}

interface UploadFormProps {
  onResult: (result: MasterAuditResponse) => void;
}

export default function UploadForm({ onResult }: UploadFormProps) {
  const [fields, setFields] = useState<AuditFormFields>({
    target_url: "",
    business_name: "",
    target_location: "",
    enable_topic6_screenshot: false,
    enable_topic7_screenshots: false,
  });
  const [files, setFiles] = useState<AuditFormFiles>({});
  const [unmatched, setUnmatched] = useState<UnmatchedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateField = (key: keyof AuditFormFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const toggleField = (key: "enable_topic6_screenshot" | "enable_topic7_screenshots") => {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }));
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

  // The actual submission - pulled out of handleSubmit so both the direct
  // path (nothing missing) and the "Proceed to audit" button on the
  // missing-inputs popup can call the same thing.
  const runAudit = async () => {
    setError(null);
    setLoading(true);
    try {
      // Kicks off all 7 topics as background tasks on the backend and
      // returns immediately with a job_id plus an initial mostly-"pending"
      // status - App.tsx picks up polling from here, so every topic below
      // fills in live, one at a time, as it finishes rather than this
      // screen waiting on the whole audit before showing anything.
      const result = await startAuditJob(fields, files);
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong starting the audit.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.target_url.trim()) {
      setError("Target URL is required.");
      return;
    }
    // Give the owner one last checkpoint before the audit locks in, if any
    // topic's CSVs are incomplete - rather than let them discover the gap
    // only after the results come back.
    if (computeMissingFileInputs(files).length > 0) {
      setShowMissingModal(true);
      return;
    }
    await runAudit();
  };

  const handleProceedAnyway = () => {
    setShowMissingModal(false);
    void runAudit();
  };

  const readiness = computeTopicReadiness(fields, files);
  const filledSlots = SLOTS.filter((s) => files[s.key]);

  return (
    <div className="intake-wrap">
      <div className="card intake-card">
        <div className="intake-title-row">
          <h1 className="intake-title">Run a new SEO audit</h1>
          <InputGuideModal />
        </div>
        <p className="intake-sub">
          Drop in whichever exports you have — files are matched to the right topic automatically by filename. Only the
          target URL is required; each topic reports honestly on what it couldn't compute from missing inputs, and
          results fill in live, topic by topic, as soon as you submit.
        </p>

        <form onSubmit={handleSubmit}>
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

            <div className="field-row checkbox-row">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={!!fields.enable_topic6_screenshot}
                  onChange={() => toggleField("enable_topic6_screenshot")}
                />
                <span>
                  Capture Google Business Profile screenshot (Topic 6)
                  <span className="checkbox-hint">
                    Real-browser page load - off by default, since this has previously crashed the live backend
                    under memory pressure. Turn on if you need the visual for this run.
                  </span>
                </span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={!!fields.enable_topic7_screenshots}
                  onChange={() => toggleField("enable_topic7_screenshots")}
                />
                <span>
                  Crawl for &amp; screenshot forms (Topic 7)
                  <span className="checkbox-hint">
                    Real-browser crawl across up to 30 pages - off by default for the same reason. Unique forms,
                    CTA counts and placement guidance are also skipped while this is off; thin content analysis
                    isn't affected either way.
                  </span>
                </span>
              </label>
            </div>
          </div>

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
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading && <span className="spinner" />}
                {loading ? "Starting audit…" : "Run full audit"}
              </button>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Results appear as soon as you submit and fill in topic by topic — no need to wait for the whole audit
                to finish before you start reading.
              </span>
            </div>
          </div>
        </form>
      </div>

      {showMissingModal && (
        <MissingInputsModal
          missing={computeMissingFileInputs(files)}
          onProceed={handleProceedAnyway}
          onReturn={() => setShowMissingModal(false)}
        />
      )}
    </div>
  );
}
