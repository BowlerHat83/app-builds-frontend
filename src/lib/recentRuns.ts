import type { MasterAuditResponse } from "../types/audit";
import { API_BASE_URL } from "../api/client";
import {
  computeCompositeScore,
  scoreTopic1,
  scoreTopic2,
  scoreTopic3,
  scoreTopic4,
  scoreTopic5,
  scoreTopic6,
  scoreTopic7,
} from "./scoring";

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
  topics?: (number | null)[]; // Topic 1-7 scores, null = not scored this run
}

export const TOPIC_SHORT = ["Accessibility", "Performance", "Organic", "AI", "Paid", "Local", "Content"];

const SCORERS = [scoreTopic1, scoreTopic2, scoreTopic3, scoreTopic4, scoreTopic5, scoreTopic6, scoreTopic7];

function topicScores(audit: MasterAuditResponse): (number | null)[] {
  return SCORERS.map((fn) => {
    try {
      const s = fn(audit.master_audit_results).score;
      return s === null ? null : Math.round(s);
    } catch {
      return null;
    }
  });
}

export function siteKey(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase();
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
  // Runs saved before per-topic scores were stored: work them out once from
  // the saved result and keep them on the index.
  const index = readIndex();
  let changed = false;
  for (const meta of index) {
    if (meta.topics) continue;
    const run = loadRecentRun(meta.id);
    if (run) {
      meta.topics = topicScores(run);
      changed = true;
    }
  }
  if (changed) writeIndex(index);
  return index;
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

// ---------- Shared (online) runs ----------
// Finished audits are also saved to the backend's shared store (a Cloud
// Storage bucket - see backend app/common/run_store.py) so they show up in
// any browser. localStorage above stays as an offline fallback / cache.

export async function fetchSharedRuns(): Promise<RecentRunMeta[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/runs`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.enabled ? (body.runs as RecentRunMeta[]) : null;
  } catch {
    return null;
  }
}

export async function openRun(id: string): Promise<MasterAuditResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/runs/${encodeURIComponent(id)}`);
    if (res.ok) return (await res.json()) as MasterAuditResponse;
  } catch {
    /* fall back to this browser's copy */
  }
  return loadRecentRun(id);
}

export async function deleteRun(id: string): Promise<RecentRunMeta[]> {
  const local = deleteRecentRun(id);
  try {
    await fetch(`${API_BASE_URL}/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    /* ignore */
  }
  return (await fetchSharedRuns()) ?? local;
}

async function saveShared(meta: RecentRunMeta, audit: MasterAuditResponse): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meta, audit }),
    });
  } catch {
    /* offline or not configured - the local copy still exists */
  }
}

// One-off upload of runs saved in this browser before shared storage
// existed, so nothing already run is lost. Returns the refreshed shared list.
export async function syncLocalToShared(shared: RecentRunMeta[]): Promise<RecentRunMeta[]> {
  // Once per browser only - otherwise a run deleted for everyone would be
  // re-uploaded by any browser that still had a local copy.
  try {
    if (localStorage.getItem("seoAudit.sharedSync.v1")) return shared;
    localStorage.setItem("seoAudit.sharedSync.v1", new Date().toISOString());
  } catch {
    return shared;
  }
  const have = new Set(shared.map((r) => siteKey(r.target_url)));
  const missing = readIndex().filter((r) => !have.has(siteKey(r.target_url)));
  if (!missing.length) return shared;
  for (const meta of missing.reverse()) {
    const audit = loadRecentRun(meta.id);
    if (audit) await saveShared({ ...meta, topics: meta.topics ?? topicScores(audit) }, audit);
  }
  return (await fetchSharedRuns()) ?? shared;
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
    topics: topicScores(audit),
  };

  // Already saved (e.g. reopening a recent run) - leave its position and date alone
  if (readIndex().some((r) => r.id === id)) return;
  void saveShared(meta, audit);
  // Keep only the latest run per site - an older run of the same domain is replaced.
  let index = readIndex().filter((r) => r.id !== id);
  for (const old of index.filter((r) => siteKey(r.target_url) === siteKey(audit.target_url))) {
    try {
      localStorage.removeItem(RUN_KEY(old.id));
    } catch {
      /* ignore */
    }
  }
  index = index.filter((r) => siteKey(r.target_url) !== siteKey(audit.target_url));
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
