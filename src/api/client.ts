import type { MasterAuditResponse } from "../types/audit";

// .trim() guards against a stray trailing newline/space in whatever set
// VITE_API_BASE_URL (e.g. pasted into a multi-line env var box) - an
// embedded control character makes the URL invalid and fetch() fails with
// a bare "Failed to fetch", silently, before any network request is even
// attempted - easy to lose an hour to since nothing shows up server-side.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").trim().replace(/\/$/, "");

export interface AuditFormFields {
  target_url: string;
  business_name?: string;
  target_location?: string;
  // What the business sells, e.g. "kitchen showroom" - distinct from the
  // brand name. Drives Topic 6's map-pack keyword set (core offering +
  // location + a handful of semantic variations) instead of testing
  // rank against branded terms, which are nearly guaranteed to already
  // rank and were skewing that average - see generate_offering_keywords
  // in topic6_local_visibility/aggregate.py. Falls back to the old
  // branded-keyword behaviour (with a warning) if left blank.
  core_offering?: string;
  // Both default to false (opt-in) - they launch a real, un-resource-
  // blocked Chromium page load (Topic 6: one GBP screenshot; Topic 7: a
  // crawl across up to 30 candidate pages) that has crashed the live
  // backend under memory pressure before this became opt-in. See
  // enable_screenshot in topic6/aggregate.py and enable_form_screenshots
  // in topic7/aggregate.py for the full history.
  enable_topic6_screenshot?: boolean;
  enable_topic7_screenshots?: boolean;
}

export interface AuditFormFiles {
  screaming_frog_csv?: File | null;
  ahrefs_backlinks_csv?: File | null;
  ahrefs_keywords_csv?: File | null;
  ahrefs_competitors_csv?: File | null;
  ai_facts_csv?: File | null;
  ai_sources_csv?: File | null;
  ppc_keywords_csv?: File | null;
  ppc_competitors_csv?: File | null;
  brightlocal_csv?: File | null;
}

// The backend runs several live checks per topic (Playwright/Chromium
// launches for WCAG, GDPR and form-detection, PageSpeed/SerpApi calls) with
// their own server-side timeouts, but on Render's free tier a cold instance
// or CPU contention can genuinely push a real run past those nominal
// budgets. Without a client-side ceiling, a stuck request just spins
// "Running full audit..." forever with zero feedback - this aborts and
// surfaces a clear error instead of hanging indefinitely.
const AUDIT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Kicks off the Chromium-heavy checks that only need the three string
// inputs (WCAG, GDPR, GBP screenshot) in the background on the backend,
// ahead of CSV upload - see app/common/prewarm_jobs.py. Intended to be
// called the moment the intake form's first screen is submitted. This is a
// best-effort head start, not a required step: on any failure here
// (network hiccup, backend briefly asleep) the caller should just proceed
// without a job_id - runMasterAudit works exactly the same either way,
// just without the pre-warmed results waiting for it.
export async function startAuditPrewarm(fields: AuditFormFields): Promise<string | null> {
  const form = new FormData();
  form.append("target_url", fields.target_url);
  if (fields.business_name) form.append("business_name", fields.business_name);
  if (fields.target_location) form.append("target_location", fields.target_location);

  try {
    const res = await fetch(`${API_BASE_URL}/audit-prewarm`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { job_id?: string };
    return body.job_id ?? null;
  } catch {
    // Best-effort only - see comment above.
    return null;
  }
}

export async function runMasterAudit(
  fields: AuditFormFields,
  files: AuditFormFiles,
  onElapsed?: (seconds: number) => void,
  jobId?: string | null
): Promise<MasterAuditResponse> {
  const form = new FormData();
  form.append("target_url", fields.target_url);
  if (fields.business_name) form.append("business_name", fields.business_name);
  if (fields.target_location) form.append("target_location", fields.target_location);
  if (fields.core_offering) form.append("core_offering", fields.core_offering);
  if (jobId) form.append("job_id", jobId);

  (Object.keys(files) as (keyof AuditFormFiles)[]).forEach((key) => {
    const file = files[key];
    if (file) form.append(key, file);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUDIT_TIMEOUT_MS);
  const startedAt = Date.now();
  const tickId = onElapsed
    ? setInterval(() => onElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000)
    : undefined;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/audit-master`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `Audit timed out after ${Math.round(AUDIT_TIMEOUT_MS / 1000)}s (target: ${API_BASE_URL}). The target ` +
          "site may be slow to crawl, or the backend (Render free tier) may be under load - try again, or " +
          "test against a smaller/faster site first."
      );
    }
    // Includes the actual configured API_BASE_URL in the message - a wrong/
    // malformed VITE_API_BASE_URL is the single most common cause of a bare
    // "Failed to fetch" here, and this makes it visible without needing
    // DevTools to go dig for it.
    throw new Error(
      `Could not reach the audit backend at ${API_BASE_URL}: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timeoutId);
    if (tickId) clearInterval(tickId);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ? JSON.stringify(body.detail) : detail;
    } catch {
      // ignore - keep statusText
    }
    throw new Error(`Audit request failed (${res.status}): ${detail}`);
  }

  return (await res.json()) as MasterAuditResponse;
}

// Full job/polling flow (see app/common/audit_jobs.py on the backend):
// kicks off all 7 topics as independent background tasks and returns
// immediately with a job_id plus an initial mostly-"pending" status. This
// call never waits on Chromium or any other slow check, so unlike
// runMasterAudit() above it can never itself hit a gateway timeout no
// matter how long the audit as a whole takes to finish. Poll
// pollAuditStatus(jobId) every few seconds afterwards to watch each topic
// fill in as it completes.
export async function startAuditJob(fields: AuditFormFields, files: AuditFormFiles): Promise<MasterAuditResponse> {
  const form = new FormData();
  form.append("target_url", fields.target_url);
  if (fields.business_name) form.append("business_name", fields.business_name);
  if (fields.target_location) form.append("target_location", fields.target_location);
  if (fields.core_offering) form.append("core_offering", fields.core_offering);
  // Always sent explicitly (not conditionally, unlike the optional string
  // fields above) so the backend always gets a real true/false rather than
  // falling back to its own default via an absent form field either way -
  // one less thing to keep in sync between the two.
  form.append("enable_topic6_screenshot", String(!!fields.enable_topic6_screenshot));
  form.append("enable_topic7_screenshots", String(!!fields.enable_topic7_screenshots));

  (Object.keys(files) as (keyof AuditFormFiles)[]).forEach((key) => {
    const file = files[key];
    if (file) form.append(key, file);
  });

  const res = await fetch(`${API_BASE_URL}/audit-start`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ? JSON.stringify(body.detail) : detail;
    } catch {
      // ignore - keep statusText
    }
    throw new Error(
      `Could not start the audit (${res.status}): ${detail}. Check the backend URL (${API_BASE_URL}) is correct and the backend is awake.`
    );
  }

  return (await res.json()) as MasterAuditResponse;
}

// Thrown specifically for a 404 on /audit-status - the job_id is unknown
// to the backend right now. On Render's free tier this is almost always a
// process restart mid-audit (an OOM kill from Chromium/Playwright memory
// use, or a redeploy) wiping the in-memory job store, not a transient
// network hiccup - the job is genuinely gone and will never come back, so
// callers should treat this as terminal (stop polling) rather than retry
// it like any other failed request.
export class AuditJobNotFoundError extends Error {}

// Single cheap poll of a running job's current state - never holds a
// request open, just reads whichever topics have finished so far. Throws
// AuditJobNotFoundError on a 404 (see above) so the caller can distinguish
// "this job is gone for good" from an ordinary transient failure, and a
// plain Error for any other network/HTTP failure.
export async function pollAuditStatus(jobId: string): Promise<MasterAuditResponse> {
  const res = await fetch(`${API_BASE_URL}/audit-status/${encodeURIComponent(jobId)}`);

  if (res.status === 404) {
    throw new AuditJobNotFoundError(
      "Lost track of this audit job - the backend most likely restarted mid-run (Render's free tier can crash-restart under memory pressure, which wipes its in-memory job store). The results already shown above are everything that was captured before that happened."
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ? JSON.stringify(body.detail) : detail;
    } catch {
      // ignore - keep statusText
    }
    throw new Error(`Could not check audit status (${res.status}): ${detail}`);
  }

  return (await res.json()) as MasterAuditResponse;
}

// Resolves a relative_path the backend returns (e.g. "/static/screenshots/x.png")
// into a full URL against the configured API base, since the frontend and API
// are served from different origins.
export function resolveAssetUrl(relativePath?: string | null): string | null {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `${API_BASE_URL}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
}
