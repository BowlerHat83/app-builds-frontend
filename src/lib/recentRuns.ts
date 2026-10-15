import type { MasterAuditResponse } from "../types/audit";
import { computeCompositeScore } from "./scoring";

// "Recent runs" on intake screen 1. The backend keeps jobs in memory only
// (they vanish when Cloud Run scales down or redeploys), so finished audits
// are saved here, in this browser's localStorage. That means recent runs are
// per-browser - a colleague on another machine won't see yours. Every read
// and write is wrapped in try/catch: storage can be full, blocked or wiped,
// and the intake screen must work regardless.

const INDEX_KEY = "seoAudit.recentRuns.v1";
const RUN_KEY = (id: string) => `seoAudit.run.v1.${id}`;
const MAX_RUNS = 8;

export interface RecentRunMeta {
  id: string;
  target_url: string;
  business_name: string | null;
  saved_at: string; // ISO date
  composite: number | null;
}

function readIndex(): RecentRunMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(index: RecentRunMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* storage unavailable - recent runs just won't persist */
  }
}

export function listRecentRuns(): RecentRunMeta[] {
  return readIndex();
}

export function loadRecentRun(id: string): MasterAuditResponse | null {
  try {
    const raw = localStorage.getItem(RUN_KEY(id));
    return raw ? (JSON.parse(raw) as MasterAuditResponse) : null;
  } catch {
    return null;
  }
}

export function deleteRecentRun(id: string): RecentRunMeta[] {
  try {
    localStorage.removeItem(RUN_KEY(id));
  } catch {
    /* ignore */
  }
  const next = readIndex().filter((r) => r.id !== id);
  writeIndex(next);
  return next;
}

export function saveRecentRun(audit: MasterAuditResponse): void {
  const id = audit.job_id || `${Date.now()}`;
  const t6 = audit.master_audit_results?.topic6_local_visibility?.data;
  const nameInput = audit.provided_inputs?.business_name;
  const businessName =
    t6?.business_name || (nameInput && !nameInput.startsWith("N/A") ? nameInput : null) || null;
  let composite: number | null = null;
  try {
    composite = computeCompositeScore(audit.master_audit_results).score;
  } catch {
    composite = null;
  }
  const meta: RecentRunMeta = {
    id,
    target_url: audit.target_url,
    business_name: businessName,
    saved_at: new Date().toISOString(),
    composite,
  };

  // Already saved (e.g. reopening a recent run) - leave its position and date alone
  if (readIndex().some((r) => r.id === id)) return;
  let index = readIndex().filter((r) => r.id !== id);
  index.unshift(meta);
  // Drop the oldest beyond MAX_RUNS
  for (const old of index.slice(MAX_RUNS)) {
    try {
      localStorage.removeItem(RUN_KEY(old.id));
    } catch {
      /* ignore */
    }
  }
  index = index.slice(0, MAX_RUNS);

  // Save the full result; if storage is full, evict oldest runs until it fits
  const payload = JSON.stringify(audit);
  for (;;) {
    try {
      localStorage.setItem(RUN_KEY(id), payload);
      break;
    } catch {
      const oldest = index.filter((r) => r.id !== id).pop();
      if (!oldest) return; // can't fit even on its own - skip saving
      index = index.filter((r) => r.id !== oldest.id);
      try {
        localStorage.removeItem(RUN_KEY(oldest.id));
      } catch {
        /* ignore */
      }
    }
  }
  writeIndex(index);
}
