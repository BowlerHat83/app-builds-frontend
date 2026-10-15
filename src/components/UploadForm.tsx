import { useEffect, useRef, useState } from "react";
import type { AuditFormFields, AuditFormFiles, DetectResult } from "../api/client";
import type { MasterAuditResponse } from "../types/audit";
import { startAuditJob, fetchIntegrationStatus, detectBusiness } from "../api/client";
import { classifyFile, SLOTS, SlotKey } from "../lib/fileClassifier";
import { computeTopicReadiness, computeMissingFileInputs, ApiSlots } from "../lib/topicReadiness";
import { listRecentRuns, loadRecentRun, deleteRecentRun, RecentRunMeta } from "../lib/recentRuns";
import TopicReadinessGrid from "./TopicReadinessGrid";
import InputGuideModal from "./layout/InputGuideModal";
import MissingInputsModal from "./MissingInputsModal";
import Tip from "./ui/Tip";

interface UnmatchedFile {
  id: string;
  file: File;
}

interface UploadFormProps {
  onResult: (result: MasterAuditResponse) => void;
}

type OverrideKey = "business_name" | "target_location" | "core_offering";

const OVERRIDES: { key: OverrideKey; label: string; placeholder: string; tip: string }[] = [
  { key: "business_name", label: "Business name", placeholder: "e.g. Bowler Hat", tip: "Used for the map-pack rank, Google reviews and matching the BrightLocal report." },
  { key: "target_location", label: "Location", placeholder: "e.g. Birmingham", tip: "The town/city used for the map-pack rank and Google reviews." },
  { key: "core_offering", label: "Core offering", placeholder: "e.g. kitchen showroom", tip: "What the business sells - drives Topic 6's map-pack keywords instead of testing rank against the brand name (which almost always ranks)." },
];

function normaliseUrl(u: string): string {
  const t = u.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function topicLabel(topics: string[]): string {
  const nums = topics.map((t) => t.replace("topic", ""));
  return nums.length > 1 ? `Topics ${nums.slice(0, -1).join(", ")} & ${nums[nums.length - 1]}` : `Topic ${nums[0]}`;
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days} day${days === 1 ? "" : "s"} ago` : new Date(iso).toLocaleDateString("en-GB");
}

export default function UploadForm({ onResult }: UploadFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState("");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const [overrides, setOverrides] = useState<Record<OverrideKey, string>>({ business_name: "", target_location: "", core_offering: "" });
  const [edited, setEdited] = useState<Record<OverrideKey, boolean>>({ business_name: false, target_location: false, core_offering: false });
  const [toggles, setToggles] = useState({ enable_topic6_screenshot: false, enable_topic7_screenshots: false });
  const [files, setFiles] = useState<AuditFormFiles>({});
  const [unmatched, setUnmatched] = useState<UnmatchedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [recent, setRecent] = useState<RecentRunMeta[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Slots the backend can fill from an API when no CSV is uploaded.
  const [integrations, setIntegrations] = useState<ApiSlots>({});

  useEffect(() => {
    void fetchIntegrationStatus().then(setIntegrations);
    setRecent(listRecentRuns());
  }, []);

  // BrightLocal is only "covered" if a Citation Tracker report actually
  // exists for this business - detection tells us whether it does.
  const apiSlots: ApiSlots = {
    ...integrations,
    brightlocal_csv: integrations.brightlocal_csv && detected?.brightlocal_report ? true : false,
  };

  // ---------- Screen 1 ----------
  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = normaliseUrl(url);
    if (!target) {
      setError("Enter the website URL to audit.");
      return;
    }
    setError(null);
    setUrl(target);
    setDetecting(true);
    const result = await detectBusiness(target);
    setDetected(result);
    setOverrides({
      business_name: result.business_name.value ?? "",
      target_location: result.target_location.value ?? "",
      core_offering: result.core_offering.value ?? "",
    });
    setEdited({ business_name: false, target_location: false, core_offering: false });
    setDetecting(false);
    setStep(2);
  };

  const openRecent = (id: string) => {
    const run = loadRecentRun(id);
    if (run) onResult(run);
    else setRecent(deleteRecentRun(id));
  };

  // ---------- Screen 2 ----------
  const setOverride = (key: OverrideKey, value: string) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
    setEdited((prev) => ({ ...prev, [key]: true }));
  };

  const sourceFor = (key: OverrideKey): string | undefined => {
    const value = overrides[key].trim();
    if (!value) return undefined;
    const det = detected?.[key];
    if (!edited[key] || (det?.value && det.value === value)) return det?.source ?? "Entered manually";
    return det?.value ? `Edited by user (detected: ${det.value})` : "Entered manually";
  };

  const fields: AuditFormFields = {
    target_url: url,
    business_name: overrides.business_name.trim(),
    target_location: overrides.target_location.trim(),
    core_offering: overrides.core_offering.trim(),
    enable_topic6_screenshot: toggles.enable_topic6_screenshot,
    enable_topic7_screenshots: toggles.enable_topic7_screenshots,
    input_sources: {
      business_name: sourceFor("business_name"),
      target_location: sourceFor("target_location"),
      core_offering: sourceFor("core_offering"),
    },
  };

  const assignFile = (key: SlotKey, file: File) => setFiles((prev) => ({ ...prev, [key]: file }));
  const removeFile = (key: SlotKey) => setFiles((prev) => ({ ...prev, [key]: null }));

  const ingestFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith(".csv"));
    const nextUnmatched: UnmatchedFile[] = [];
    incoming.forEach((file) => {
      const match = classifyFile(file.name);
      if (match) assignFile(match, file);
      else nextUnmatched.push({ id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`, file });
    });
    if (nextUnmatched.length) setUnmatched((prev) => [...prev, ...nextUnmatched]);
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

  const runAudit = async () => {
    setError(null);
    setLoading(true);
    try {
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
    if (computeMissingFileInputs(files, apiSlots).length > 0) {
      setShowMissingModal(true);
      return;
    }
    await runAudit();
  };

  const readiness = computeTopicReadiness(fields, files, apiSlots);
  const filledSlots = SLOTS.filter((s) => files[s.key]);
  // Below the drop zone: only what's still outstanding (the topic cards
  // already show everything that's covered). SpyFu is listed separately as
  // recommended-but-optional, since Topic 5 falls back to an Ahrefs estimate.
  const waitingSlots = SLOTS.filter((s) => !files[s.key] && !apiSlots[s.key]);
  const recommendedSlots = SLOTS.filter((s) => !files[s.key] && apiSlots[s.key] === "estimate");

  if (step === 1) {
    return (
      <div className="intake-wrap">
        <div className="card intake-card">
          <h1 className="intake-title">Run a new SEO audit</h1>
          <p className="intake-sub">Enter the website to audit. The business details are worked out automatically on the next screen.</p>
          <form onSubmit={handleNext} className="url-step">
            <input
              className="url-step-input"
              type="text"
              placeholder="https://example.com"
              value={url}
              autoFocus
              onChange={(e) => setUrl(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={detecting}>
              {detecting && <span className="spinner" />}
              {detecting ? "Detecting business…" : "Next →"}
            </button>
          </form>
          {error && <div className="status-banner error" style={{ marginTop: 12 }}>{error}</div>}

          <div className="intake-section">
            <p className="intake-section-label">Recent runs</p>
            {recent.length === 0 ? (
              <p className="recent-empty">No saved audits in this browser yet - finished audits appear here so you can reopen them.</p>
            ) : (
              <ul className="recent-list">
                {recent.map((r) => (
                  <li key={r.id} className="recent-item">
                    <button type="button" className="recent-open" onClick={() => openRecent(r.id)}>
                      <span className="recent-name">{r.business_name || r.target_url.replace(/^https?:\/\//, "")}</span>
                      <span className="recent-meta">
                        {r.target_url.replace(/^https?:\/\//, "")} · {timeAgo(r.saved_at)}
                      </span>
                    </button>
                    {r.composite != null && <span className="recent-score">{Math.round(r.composite)}</span>}
                    <button type="button" className="link-btn" aria-label="Remove" onClick={() => setRecent(deleteRecentRun(r.id))}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="intake-wrap">
      <div className="card intake-card">
        <div className="intake-title-row">
          <div>
            <button type="button" className="link-btn" onClick={() => setStep(1)}>← Change URL</button>
            <h1 className="intake-title">{overrides.business_name || detected?.domain || url}</h1>
            <p className="intake-sub" style={{ marginTop: 2 }}>{url}</p>
          </div>
          <InputGuideModal />
        </div>

        <form onSubmit={handleSubmit}>
          <details className="override-panel">
            <summary>
              <span className="override-title">Business details</span>
              <span className="override-summary">
                {OVERRIDES.map((o) => overrides[o.key] || "—").join(" · ")}
              </span>
              <span className="override-hint">Edit if incorrect</span>
            </summary>
            <div className="field-row field-row-3">
              {OVERRIDES.map((o) => (
                <div className="field" key={o.key}>
                  <label htmlFor={o.key}>
                    {o.label}
                    <Tip text={o.tip} />
                  </label>
                  <input id={o.key} type="text" placeholder={o.placeholder} value={overrides[o.key]} onChange={(e) => setOverride(o.key, e.target.value)} />
                  <span className="field-source">
                    {edited[o.key] && overrides[o.key] !== (detected?.[o.key].value ?? "")
                      ? "Edited"
                      : detected?.[o.key].source
                      ? `From ${detected[o.key].source}`
                      : "Couldn't detect - enter manually"}
                  </span>
                </div>
              ))}
            </div>
          </details>

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
              <div className="dropzone-sub">Screaming Frog, Waikay and SpyFu exports — Ahrefs and BrightLocal are pulled automatically where available</div>
              <input ref={fileInputRef} type="file" accept=".csv" multiple onChange={handleBrowsePick} />
            </div>

            {(waitingSlots.length > 0 || recommendedSlots.length > 0) ? (
              <div className="inputs-needed">
                {waitingSlots.length > 0 && (
                  <div className="inputs-needed-group">
                    <p className="inputs-needed-heading">Still waiting for</p>
                    <ul>
                      {waitingSlots.map((s) => (
                        <li key={s.key}>
                          <span className="inputs-needed-dot">○</span>
                          <span>
                            <strong>{s.label}</strong> <span className="inputs-needed-topics">· {topicLabel(s.topics)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {recommendedSlots.length > 0 && (
                  <div className="inputs-needed-group">
                    <p className="inputs-needed-heading">Recommended (optional)</p>
                    <ul>
                      {recommendedSlots.map((s) => (
                        <li key={s.key}>
                          <span className="inputs-needed-dot optional">+</span>
                          <span>
                            <strong>SpyFu {s.label}</strong> <span className="inputs-needed-topics">· {topicLabel(s.topics)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="inputs-needed-note">
                      Not required - without these, Topic 5 uses an Ahrefs estimate, which usually understates real paid
                      activity. Upload them for full paid keyword, CPC and competitor data.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="inputs-needed-done">✓ Every input is covered - ready to run.</p>
            )}
            {filledSlots.length > 0 && (
              <p className="inputs-uploaded">
                {filledSlots.length} file{filledSlots.length === 1 ? "" : "s"} uploaded - dropping a new export for the same
                topic replaces it.{" "}
                <button type="button" className="link-btn" onClick={() => setFiles({})}>
                  Clear uploads
                </button>
              </p>
            )}

            {unmatched.length > 0 && (
              <div className="unmatched-list">
                {unmatched.map((u) => (
                  <div key={u.id} className="unmatched-item">
                    <span className="filename">⚠ {u.file.name}</span>
                    <select defaultValue="" onChange={(e) => e.target.value && assignUnmatched(u.id, e.target.value as SlotKey)}>
                      <option value="" disabled>
                        Assign to…
                      </option>
                      {SLOTS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="link-btn" onClick={() => setUnmatched((prev) => prev.filter((x) => x.id !== u.id))}>
                      Discard
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="field-row checkbox-row">
              <div className="checkbox-field-wrap">
                <label className="checkbox-field">
                  <input type="checkbox" checked={toggles.enable_topic6_screenshot} onChange={() => setToggles((t) => ({ ...t, enable_topic6_screenshot: !t.enable_topic6_screenshot }))} />
                  <span>Capture Google Business Profile screenshot (Topic 6)</span>
                </label>
                <Tip text="Real-browser page load - off by default, since this has previously crashed the live backend under memory pressure." />
              </div>
              <div className="checkbox-field-wrap">
                <label className="checkbox-field">
                  <input type="checkbox" checked={toggles.enable_topic7_screenshots} onChange={() => setToggles((t) => ({ ...t, enable_topic7_screenshots: !t.enable_topic7_screenshots }))} />
                  <span>Crawl for &amp; screenshot forms (Topic 7)</span>
                </label>
                <Tip text="Real-browser crawl across up to 30 pages - off by default for the same reason. Thin content analysis isn't affected either way." />
              </div>
            </div>
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
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Results fill in topic by topic as soon as you start.</span>
            </div>
          </div>
        </form>
      </div>

      {showMissingModal && (
        <MissingInputsModal
          missing={computeMissingFileInputs(files, apiSlots)}
          onProceed={() => {
            setShowMissingModal(false);
            void runAudit();
          }}
          onReturn={() => setShowMissingModal(false)}
        />
      )}
    </div>
  );
}
