import type { AuditFormFiles } from "../api/client";

export type SlotKey = keyof AuditFormFiles;

export interface SlotDef {
  key: SlotKey;
  label: string;
  hint: string;
  topics: string[]; // which topic keys this file feeds (matches TopNav tab keys)
}

export const SLOTS: SlotDef[] = [
  { key: "screaming_frog_csv", label: "Screaming Frog export", hint: "Internal HTML export", topics: ["topic2", "topic7"] },
  { key: "ahrefs_backlinks_csv", label: "Ahrefs backlinks", hint: "Backlinks export", topics: ["topic3"] },
  { key: "ahrefs_keywords_csv", label: "Ahrefs organic keywords", hint: "Organic Keywords export", topics: ["topic3"] },
  { key: "ahrefs_competitors_csv", label: "Ahrefs organic competitors", hint: "Organic Competitors export", topics: ["topic3"] },
  { key: "ai_facts_csv", label: "AI visibility facts", hint: "AI-visibility tracker facts export", topics: ["topic4"] },
  { key: "ai_sources_csv", label: "AI visibility knowledge sources", hint: "AI-visibility tracker knowledge sources export", topics: ["topic4"] },
  { key: "ppc_keywords_csv", label: "PPC keyword research", hint: "PPC keyword-research export", topics: ["topic5"] },
  { key: "ppc_competitors_csv", label: "PPC competitor overlap", hint: "PPC competitor-overlap export", topics: ["topic5"] },
  { key: "brightlocal_csv", label: "BrightLocal citation tracker", hint: "Citation Tracker export", topics: ["topic6"] },
];

// Order matters: more specific patterns (e.g. PPC competitors) are checked
// before more general ones (e.g. any "competitors" file) so a real filename
// like "Competitors_bowlerhat-co-uk_..._PPC.csv" lands in the right slot
// instead of the Ahrefs one just because both contain "competitors".
const RULES: { key: SlotKey; test: (name: string) => boolean }[] = [
  { key: "brightlocal_csv", test: (n) => /citation.?tracker/.test(n) || /brightlocal/.test(n) },
  { key: "ppc_competitors_csv", test: (n) => n.includes("competitor") && n.includes("ppc") },
  { key: "ppc_keywords_csv", test: (n) => n.includes("ppc") && n.includes("keyword") },
  { key: "ahrefs_competitors_csv", test: (n) => /orgcompetitors|organic.?competitors/.test(n) || (n.includes("competitor") && !n.includes("ppc")) },
  { key: "ahrefs_keywords_csv", test: (n) => /organic.?keywords/.test(n) },
  { key: "ahrefs_backlinks_csv", test: (n) => n.includes("backlink") },
  { key: "ai_facts_csv", test: (n) => /facts.?export/.test(n) || /(^|[_-])facts([_-]|\.)/.test(n) },
  { key: "ai_sources_csv", test: (n) => /sources.?export/.test(n) || /knowledge.?sources/.test(n) || /(^|[_-])sources([_-]|\.)/.test(n) },
  { key: "screaming_frog_csv", test: (n) => /internal.*html/.test(n) || /internal_all/.test(n) || /screaming.?frog/.test(n) },
];

export function classifyFile(filename: string): SlotKey | null {
  const n = filename.toLowerCase();
  for (const rule of RULES) {
    if (rule.test(n)) return rule.key;
  }
  return null;
}

export function slotDef(key: SlotKey): SlotDef {
  const found = SLOTS.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown slot key: ${key}`);
  return found;
}
