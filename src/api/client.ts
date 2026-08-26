import type { MasterAuditResponse } from "../types/audit";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export interface AuditFormFields {
  target_url: string;
  business_name?: string;
  target_location?: string;
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

export async function runMasterAudit(
  fields: AuditFormFields,
  files: AuditFormFiles,
  onElapsed?: (seconds: number) => void
): Promise<MasterAuditResponse> {
  const form = new FormData();
  form.append("target_url", fields.target_url);
  if (fields.business_name) form.append("business_name", fields.business_name);
  if (fields.target_location) form.append("target_location", fields.target_location);

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
        `Audit timed out after ${Math.round(AUDIT_TIMEOUT_MS / 1000)}s. The target site may be slow to ` +
          "crawl, or the backend (Render free tier) may be under load - try again, or test against a " +
          "smaller/faster site first."
      );
    }
    throw new Error(`Could not reach the audit backend: ${err instanceof Error ? err.message : String(err)}`);
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

// Resolves a relative_path the backend returns (e.g. "/static/screenshots/x.png")
// into a full URL against the configured API base, since the frontend and API
// are served from different origins.
export function resolveAssetUrl(relativePath?: string | null): string | null {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `${API_BASE_URL}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
}
