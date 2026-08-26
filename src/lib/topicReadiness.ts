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
