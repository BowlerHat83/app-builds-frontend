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

export async function runMasterAudit(
  fields: AuditFormFields,
  files: AuditFormFiles
): Promise<MasterAuditResponse> {
  const form = new FormData();
  form.append("target_url", fields.target_url);
  if (fields.business_name) form.append("business_name", fields.business_name);
  if (fields.target_location) form.append("target_location", fields.target_location);

  (Object.keys(files) as (keyof AuditFormFiles)[]).forEach((key) => {
    const file = files[key];
    if (file) form.append(key, file);
  });

  const res = await fetch(`${API_BASE_URL}/audit-master`, {
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
