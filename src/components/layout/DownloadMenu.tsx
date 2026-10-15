import { useEffect, useState } from "react";
import type { MasterAuditResponse } from "../../types/audit";
import { buildClientReport, reportFilename, THEMES, BrandKey, ReportKind } from "../../lib/report/clientReport";
import { hostnameOf } from "../../lib/format";

interface DownloadMenuProps {
  audit: MasterAuditResponse;
}

const BRAND_ORDER: BrandKey[] = ["bowlerhat", "alltru", "cobrand", "unbranded"];

// "Export for the client" - plain-English, branded HTML (modelled on the
// WCAG scanner's client export). Summary = where they stand + what to do;
// Full report = the same plus the supporting tables. Opens or downloads a
// self-contained HTML file; printing it from the browser gives a clean PDF.
export default function DownloadMenu({ audit }: DownloadMenuProps) {
  const t6Name = audit.master_audit_results?.topic6_local_visibility?.data?.business_name;
  const defaultClient = t6Name || hostnameOf(audit.target_url)?.replace(/^www\./, "") || "";

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<ReportKind>("summary");
  const [brand, setBrand] = useState<BrandKey>("bowlerhat");
  const [clientName, setClientName] = useState(defaultClient);
  const [preparedBy, setPreparedBy] = useState(THEMES.bowlerhat.defaultPreparedBy);
  const [preparedEdited, setPreparedEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const chooseBrand = (b: BrandKey) => {
    setBrand(b);
    if (!preparedEdited) setPreparedBy(THEMES[b].defaultPreparedBy);
  };

  const build = async (): Promise<Blob | null> => {
    setBusy(true);
    setError(null);
    try {
      const html = await buildClientReport(audit, { kind, brand, clientName, preparedBy });
      return new Blob([html], { type: "text/html;charset=utf-8" });
    } catch (err) {
      setError(err instanceof Error ? `Couldn't build the report: ${err.message}` : "Couldn't build the report.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async () => {
    const tab = window.open("", "_blank");
    const blob = await build();
    if (!blob) {
      tab?.close();
      return;
    }
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleDownload = async () => {
    const blob = await build();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFilename(audit, kind);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setOpen(false);
  };

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        ⬇ Download
      </button>
      {open && (
        <div className="guide-overlay" onClick={() => setOpen(false)}>
          <div className="guide-modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-h" onClick={(e) => e.stopPropagation()}>
            <div className="guide-modal-head">
              <h2 id="export-h">Export for the client</h2>
              <button type="button" className="guide-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="guide-modal-body export-body">
              <p className="export-intro">
                A plain-English report for the site owner: where they stand, how urgent it is and what to do next.
              </p>

              <fieldset className="export-group">
                <legend>What to export</legend>
                <label className="export-radio">
                  <input type="radio" name="kind" checked={kind === "summary"} onChange={() => setKind("summary")} />
                  <span>
                    Summary report<small>Scores, findings and recommendations</small>
                  </span>
                </label>
                <label className="export-radio">
                  <input type="radio" name="kind" checked={kind === "full"} onChange={() => setKind("full")} />
                  <span>
                    Full report<small>The summary plus detailed tables for each topic</small>
                  </span>
                </label>
              </fieldset>

              <fieldset className="export-group">
                <legend>Branding</legend>
                <div className="export-brands">
                  {BRAND_ORDER.map((b) => (
                    <label key={b} className={`export-brand${brand === b ? " on" : ""}`}>
                      <input type="radio" name="brand" checked={brand === b} onChange={() => chooseBrand(b)} />
                      <span className="export-swatch" style={{ background: THEMES[b].dark }}>
                        <i style={{ background: THEMES[b].accent }} />
                        <i style={{ background: THEMES[b].highlight }} />
                      </span>
                      {THEMES[b].label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="export-fields">
                <label>
                  Client name
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client or website" />
                </label>
                <label>
                  Prepared by
                  <input
                    value={preparedBy}
                    onChange={(e) => {
                      setPreparedBy(e.target.value);
                      setPreparedEdited(true);
                    }}
                    placeholder="Your agency"
                  />
                </label>
              </div>

              <p className="export-hint">Need a PDF? Open the report and use your browser's Print → Save as PDF.</p>
              {error && <div className="status-banner error">{error}</div>}
            </div>
            <div className="export-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleOpen} disabled={busy}>
                Open
              </button>
              <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={busy}>
                {busy && <span className="spinner" />} Download HTML
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
