import type { SlotKey } from "./fileClassifier";

/**
 * Where each CSV upload slot comes from, in the source tool's own UI.
 *
 * This is content, not logic — it exists to answer "where do I get this file"
 * for whoever is running an audit. `confirmed: true` entries have been walked
 * through against a real export from the tool (screenshot + a matching sample
 * file); `confirmed: false` entries are a best guess from the filename-matching
 * rules in fileClassifier.ts and still need a screenshot to lock down the exact
 * path and export button.
 *
 * Rough guide — fill in the unconfirmed entries as we get screenshots for them.
 */

export interface CsvSourceGuideEntry {
  key: SlotKey;
  tool: string;
  reportName: string;
  /** Breadcrumb of clicks inside the source tool, in order. */
  path: string[];
  /** What the exported filename tends to look like / contain. */
  filenameHint: string;
  /** Plain-English description of what this file is used for in the audit. */
  whatItFeeds: string;
  confirmed: boolean;
  notes?: string;
}

export const CSV_SOURCE_GUIDE: CsvSourceGuideEntry[] = [
  {
    key: "ahrefs_backlinks_csv",
    tool: "Ahrefs",
    reportName: "Backlinks report",
    path: [
      "Site Explorer",
      "Enter the domain (e.g. bowlerhat.co.uk)",
      "Scope dropdown → Subdomains",
      "Sidebar → Backlink profile → Backlinks",
      "Export (top right) → CSV",
    ],
    filenameHint: "e.g. bowlerhat.co.ukbacklinkssubdomains_20260824_143437.csv — contains \"backlink\" in the name",
    whatItFeeds:
      "Topic 3 (Organic Visibility) → backlink profile: total backlinks, unique referring domains, dofollow/nofollow split.",
    confirmed: true,
    notes:
      "Per-link report (one row per backlink) — columns include Domain rating, UR, Anchor, Nofollow/UGC/Sponsored, First/Last seen. Don't confuse with the \"Referring domains\" report, which is a different, domain-level export.",
  },
  {
    key: "ahrefs_keywords_csv",
    tool: "Ahrefs",
    reportName: "Organic keywords report",
    path: [
      "Site Explorer",
      "Enter the domain",
      "Scope dropdown → Subdomains",
      "Sidebar → Organic search → Organic keywords",
      "Export (top right) → CSV",
    ],
    filenameHint: "contains \"organic-keywords\" / \"organic keywords\" in the name",
    whatItFeeds:
      "Topic 3 → keyword position, top keywords, content gaps, branded traffic, traffic/impressions, and the modeled 12-month traffic estimate.",
    confirmed: true,
    notes:
      "Country and date filters at the top of the page (e.g. United Kingdom, a specific date) shape what's in the export — set them to match the audit's target market before exporting.",
  },
  {
    key: "ahrefs_competitors_csv",
    tool: "Ahrefs",
    reportName: "Organic competitors report",
    path: [
      "Site Explorer",
      "Enter the domain",
      "Scope dropdown → Subdomains",
      "Sidebar → Competitive analysis → Organic competitors",
      "Export (top right, above the \"Top competing domains\" table)",
    ],
    filenameHint: "e.g. bowlerhat.co.uk_orgcompetitors_subdomains_gb_20260826_090411.csv — contains \"orgcompetitors\" or \"organic competitors\"",
    whatItFeeds:
      "Topic 3 → Domain Rating comparison and competitor market-share breakdown (feeds the DR-based adjustment to the keyword-position score).",
    confirmed: true,
    notes:
      "This report only ever lists competitor domains (Domain, DR, Traffic, Value, Share, Keywords, Pages) — it never includes the target site's own DR, which is why Topic 3 doesn't score a standalone \"authority\" metric.",
  },
  {
    key: "ai_sources_csv",
    tool: "Waikay",
    reportName: "Knowledge sources export (Sources tab)",
    path: [
      "Waikay → open the tracked brand/project",
      "Left sidebar → link icon (Sources)",
      "Topic Sources or Prompt Sources tab",
      "Export to CSV (top right, above the sources table)",
    ],
    filenameHint: "contains \"sources\" in the name (e.g. ...sources_export...) — columns: Source, Category, Matched Entities, Total Citations, URL, Models Breakdown",
    whatItFeeds:
      "Topic 4 (AI Visibility) → engine visibility breakdown (needs both this and the Facts export together), top competitors, top keywords, and top cited URLs.",
    confirmed: true,
  },
  {
    key: "ai_facts_csv",
    tool: "Waikay",
    reportName: "Facts export",
    path: [
      "Waikay → open the tracked brand/project",
      "Left sidebar → tree/hierarchy icon (Facts)",
      "Facts page",
      "Export to CSV (top right)",
    ],
    filenameHint: "contains \"facts\" in the name — columns: Date, Prompt, Fact, LLM Model, Status",
    whatItFeeds:
      "Topic 4 → engine visibility breakdown (paired with the Sources export — \"LLM Model\" is matched against Gemini/ChatGPT/Claude/Sonar) and the cited-search-terms count in the topic summary.",
    confirmed: true,
  },
  {
    key: "screaming_frog_csv",
    tool: "Screaming Frog SEO Spider",
    reportName: "Internal HTML export",
    path: [
      "Crawl the target site",
      "Internal tab → filter to HTML",
      "Export",
    ],
    filenameHint: "contains \"internal\" and \"html\" in the name (e.g. internal_all.csv)",
    whatItFeeds: "Topic 2 (Performance) and Topic 7 (screenshots/on-page checks).",
    confirmed: false,
    notes: "ROUGH — not yet confirmed against a real export/screenshot. Path above is the standard Screaming Frog export location; needs verifying against an actual file.",
  },
  {
    key: "ppc_keywords_csv",
    tool: "TBD (PPC keyword-research tool)",
    reportName: "PPC keyword-research export",
    path: ["Not yet confirmed"],
    filenameHint: "contains \"ppc\" and \"keyword\" in the name",
    whatItFeeds: "Topic 5 (Paid Search Competitive Standing) → the target site's own paid keyword count / monthly clicks / estimated spend.",
    confirmed: false,
    notes: "ROUGH — need a screenshot of the source tool and an example export to confirm exactly where this comes from.",
  },
  {
    key: "ppc_competitors_csv",
    tool: "TBD (PPC competitor-overlap tool)",
    reportName: "PPC competitor-overlap export",
    path: ["Not yet confirmed"],
    filenameHint: "contains \"competitor\" and \"ppc\" in the name",
    whatItFeeds: "Topic 5 → competitor benchmark averages (keywords / clicks / budget) that the target's own paid metrics are compared against.",
    confirmed: false,
    notes: "ROUGH — need a screenshot of the source tool and an example export to confirm exactly where this comes from.",
  },
  {
    key: "brightlocal_csv",
    tool: "BrightLocal",
    reportName: "Citation Tracker export",
    path: [
      "BrightLocal dashboard",
      "Local SEO Tools → Citation Tracker",
      "Select the campaign",
      "Export",
    ],
    filenameHint: "contains \"citation tracker\" or \"brightlocal\" in the name",
    whatItFeeds: "Topic 6 (Local Visibility) → citation consistency alongside the live SerpApi map-pack/reviews checks.",
    confirmed: false,
    notes: "ROUGH — standard BrightLocal export location, but not yet confirmed against a real file from this account.",
  },
];

export function csvSourceGuideFor(key: SlotKey): CsvSourceGuideEntry | undefined {
  return CSV_SOURCE_GUIDE.find((e) => e.key === key);
}
