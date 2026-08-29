import type { AuditFormFields, AuditFormFiles } from "../api/client";
import { SLOTS, SlotKey } from "./fileClassifier";

export interface ReadinessPart {
  label: string;
  met: boolean;
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

export function computeTopicReadiness(fields: AuditFormFields, files: AuditFormFiles): TopicReadiness[] {
  const urlFilled = Boolean(fields.target_url && fields.target_url.trim());

  return TOPIC_DEFS.map((topic) => {
    const parts: ReadinessPart[] = [];
    if (topic.hasLiveCheck) {
      parts.push({ label: "Target URL (live checks)", met: urlFilled });
    }
    topic.fileSlots.forEach((slotKey) => {
      const def = SLOTS.find((s) => s.key === slotKey);
      parts.push({ label: def?.label ?? slotKey, met: Boolean(files[slotKey]) });
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
export function computeMissingFileInputs(files: AuditFormFiles): MissingTopicInputs[] {
  return TOPIC_DEFS.filter((topic) => topic.fileSlots.length > 0)
    .map((topic) => {
      const missingFiles = topic.fileSlots
        .filter((slotKey) => !files[slotKey])
        .map((slotKey) => SLOTS.find((s) => s.key === slotKey)?.label ?? slotKey);
      return { key: topic.key, label: topic.label, missingFiles };
    })
    .filter((topic) => topic.missingFiles.length > 0);
}
