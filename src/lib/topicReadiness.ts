import type { AuditFormFields, AuditFormFiles } from "../api/client";
import { SLOTS, SlotKey } from "./fileClassifier";

export interface ReadinessPart {
  label: string;
  met: boolean;
  // true when the slot is only covered by a lower-fidelity fallback
  // (e.g. Topic 5's Ahrefs paid-search estimate) - the topic card shows
  // amber rather than green for these.
  estimate?: boolean;
  via?: "csv" | "api" | "estimate" | "live";
}

export interface TopicReadiness {
  key: string;
  label: string;
  parts: ReadinessPart[];
  metCount: number;
  totalCount: number;
}

const TOPIC_DEFS: { key: string; label: string; fileSlots: SlotKey[]; hasLiveCheck: boolean }[] = [
  { key: "topic1", label: "Topic 1: Accessibility", fileSlots: [], hasLiveCheck: true },
  { key: "topic2", label: "Topic 2: Performance", fileSlots: ["screaming_frog_csv"], hasLiveCheck: true },
  { key: "topic3", label: "Topic 3: Organic Visibility", fileSlots: ["ahrefs_backlinks_csv", "ahrefs_keywords_csv", "ahrefs_competitors_csv"], hasLiveCheck: false },
  { key: "topic4", label: "Topic 4: AI Visibility", fileSlots: ["ai_facts_csv", "ai_sources_csv"], hasLiveCheck: false },
  { key: "topic5", label: "Topic 5: Paid Visibility", fileSlots: ["ppc_keywords_csv", "ppc_competitors_csv"], hasLiveCheck: false },
  { key: "topic6", label: "Topic 6: Local Visibility", fileSlots: ["brightlocal_csv"], hasLiveCheck: true },
  { key: "topic7", label: "Topic 7: Content Quality", fileSlots: ["screaming_frog_csv"], hasLiveCheck: true },
];

export type ApiSlots = Partial<Record<SlotKey, boolean | "estimate">>;

export function computeTopicReadiness(fields: AuditFormFields, files: AuditFormFiles, apiSlots: ApiSlots = {}): TopicReadiness[] {
  const urlFilled = Boolean(fields.target_url && fields.target_url.trim());

  return TOPIC_DEFS.map((topic) => {
    const parts: ReadinessPart[] = [];
    if (topic.hasLiveCheck) {
      parts.push({ label: "Live checks on the site", met: urlFilled, via: "live" });
    }
    topic.fileSlots.forEach((slotKey) => {
      const def = SLOTS.find((s) => s.key === slotKey);
      const label = def?.label ?? slotKey;
      if (files[slotKey]) {
        parts.push({ label, met: true, via: "csv" });
      } else if (apiSlots[slotKey] === "estimate") {
        parts.push({ label: `${label} (Ahrefs estimate)`, met: true, estimate: true, via: "estimate" });
      } else if (apiSlots[slotKey]) {
        parts.push({ label: `${label} (auto via API)`, met: true, via: "api" });
      } else {
        parts.push({ label, met: false });
      }
    });
    const metCount = parts.filter((p) => p.met).length;
    return { key: topic.key, label: topic.label, parts, metCount, totalCount: parts.length };
  });
}


export interface MissingTopicInputs {
  key: string;
  label: string;
  missingFiles: string[];
}

// Used by the launch-confirmation popup - separate from computeTopicReadiness
// above because that also tracks the live-check (target URL) part, which is
// always satisfied by the time this is checked (the form already blocks
// submission without a URL). This only reports missing CSV slots, grouped
// by the topic(s) each one feeds, so the popup can say exactly what's
// absent rather than a vague "some data is missing".
export function computeMissingFileInputs(files: AuditFormFiles, apiSlots: ApiSlots = {}): MissingTopicInputs[] {
  return TOPIC_DEFS.filter((topic) => topic.fileSlots.length > 0)
    .map((topic) => {
      const missingFiles = topic.fileSlots
        .filter((slotKey) => !files[slotKey] && !apiSlots[slotKey])
        .map((slotKey) => SLOTS.find((s) => s.key === slotKey)?.label ?? slotKey);
      return { key: topic.key, label: topic.label, missingFiles };
    })
    .filter((topic) => topic.missingFiles.length > 0);
}
