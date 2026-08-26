import { useEffect, useRef, useState } from "react";
import type { MasterAuditResponse } from "../../types/audit";
import { generateExecutiveSummaryPdf } from "../../lib/pdf/executiveSummary";
import { generateFullReportPdf } from "../../lib/pdf/fullReport";

interface DownloadMenuProps {
  audit: MasterAuditResponse;
}

export default function DownloadMenu({ audit }: DownloadMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      setOpen(false);
    } catch (err) {
      alert(err instanceof Error ? `Couldn't generate that PDF: ${err.message}` : "Couldn't generate that PDF.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="download-menu-wrap" ref={wrapRef}>
      <button className="btn" onClick={() => setOpen((v) => !v)}>
        {busy ? <span className="spinner" /> : "⬇"} Download
      </button>
      {open && (
        <div className="download-menu">
          <button onClick={() => run("summary", () => generateExecutiveSummaryPdf(audit))} disabled={!!busy}>
            Executive Summary
            <small>1-page branded overview — grades &amp; headline metrics per topic</small>
          </button>
          <button onClick={() => run("full", () => generateFullReportPdf(audit))} disabled={!!busy}>
            Full Report
            <small>Complete branded PDF — every table across all 7 topics</small>
          </button>
        </div>
      )}
    </div>
  );
}
