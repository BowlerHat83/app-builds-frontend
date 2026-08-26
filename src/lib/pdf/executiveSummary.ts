import type { MasterAuditResponse } from "../../types/audit";
import { computeCompositeScore, scoreTopic1, scoreTopic2, scoreTopic3, scoreTopic4, scoreTopic6, scoreTopic7, gradeFromScore } from "../scoring";
import { fmtInt, fmtPercent, fmtCurrencyGBP, fmtDash } from "../format";
import { newDoc, drawCoverBrandHeader, drawSectionTitle, drawStatRow, ensureSpace, drawFooters, PAGE, CONTENT_WIDTH, StatItem } from "./pdfHelpers";

function gradeColorRgb(score: number | null): [number, number, number] {
  const { color } = gradeFromScore(score);
  // gradeFromScore returns a CSS var name for on-screen use; map to concrete
  // RGB here since jsPDF can't resolve CSS custom properties.
  if (color === "var(--accent)") return [47, 224, 168];
  if (color === "var(--accent-amber)") return [245, 166, 35];
  if (color === "var(--accent-orange)") return [245, 130, 74];
  if (color === "var(--accent-red)") return [239, 69, 96];
  return [110, 120, 145];
}

export async function generateExecutiveSummaryPdf(audit: MasterAuditResponse): Promise<void> {
  const doc = newDoc();
  const results = audit.master_audit_results;
  const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  let y = await drawCoverBrandHeader(doc, audit.target_url, generatedAt);

  const composite = computeCompositeScore(results);
  const gradeRgb = gradeColorRgb(composite.score);

  doc.setFillColor(...gradeRgb);
  doc.roundedRect(PAGE.margin, y, 150, 58, 6, 6, "F");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("COMPOSITE GRADE", PAGE.margin + 12, y + 18);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text(composite.grade, PAGE.margin + 12, y + 44);
  doc.setFont("helvetica", "normal");

  doc.setFontSize(9);
  doc.setTextColor(110, 120, 145);
  doc.text("COMPOSITE SCORE", PAGE.margin + 170, y + 18);
  doc.setFontSize(20);
  doc.setTextColor(20, 24, 38);
  doc.setFont("helvetica", "bold");
  doc.text(composite.score !== null ? `${composite.score}%` : "–", PAGE.margin + 170, y + 44);
  doc.setFont("helvetica", "normal");
  y += 78;

  doc.setFontSize(8.5);
  doc.setTextColor(110, 120, 145);
  doc.text(
    "Composite grade/score is calculated from real metrics across topics (WCAG & GDPR scores, Lighthouse performance,",
    PAGE.margin,
    y,
    { maxWidth: CONTENT_WIDTH }
  );
  y += 11;
  doc.text("keyword rankings, AI citation ratio, local/reviews data, thin-content rate) — Paid Visibility isn't included.", PAGE.margin, y, { maxWidth: CONTENT_WIDTH });
  y += 24;

  const t1 = results.topic1_technical.data;
  const t2 = results.topic2_performance.data;
  const t3 = results.topic3_organic_visibility.data;
  const t4 = results.topic4_ai_visibility.data;
  const t5 = results.topic5_paid_visibility.data;
  const t6 = results.topic6_local_visibility.data;
  const t7 = results.topic7_content_quality.data;

  const sections: { title: string; score: number | null; stats: StatItem[] }[] = [
    {
      title: "Topic 1 — Accessibility & Compliance",
      score: scoreTopic1(results).score,
      stats: [
        { label: "Sitemap", value: t1.technical_standards?.sitemap?.found ? "Found" : "Not found" },
        { label: "WCAG Score", value: t1.wcag_accessibility ? `${fmtInt(t1.wcag_accessibility.score)}/100` : "–" },
        { label: "GDPR Compliant", value: t1.gdpr_compliance ? (t1.gdpr_compliance.is_gdpr_compliant ? "Yes" : "No") : "–" },
        { label: "SSL Days Remaining", value: fmtInt(t1.technical_standards?.ssl_certificate?.days_remaining) },
      ],
    },
    {
      title: "Topic 2 — Performance",
      score: scoreTopic2(results).score,
      stats: [
        { label: "Performance Score", value: t2.core_web_vitals?.performance_score != null ? `${t2.core_web_vitals.performance_score}/100` : "N/A" },
        { label: "LCP", value: t2.core_web_vitals?.lcp_ms != null ? `${(t2.core_web_vitals.lcp_ms / 1000).toFixed(1)}s` : "–" },
        { label: "Indexation Errors", value: fmtInt(t2.metadata_analysis?.indexation_errors_count) },
        { label: "Missing H1s", value: fmtInt(t2.metadata_analysis?.meta_counts?.missing_h1) },
      ],
    },
    {
      title: "Topic 3 — Organic Visibility",
      score: scoreTopic3(results).score,
      stats: [
        { label: "Backlinks", value: fmtInt(t3.backlinks_summary?.total_backlinks) },
        { label: "Referring Domains", value: fmtInt(t3.backlinks_summary?.unique_referring_domains) },
        { label: "Avg Keyword Position", value: fmtDash(t3.keyword_position?.metrics?.average_position) },
        { label: "Monthly Organic Clicks", value: fmtInt(t3.traffic_impressions?.metrics?.estimated_organic_clicks) },
      ],
    },
    {
      title: "Topic 4 — AI Visibility",
      score: scoreTopic4(results).score,
      stats: [
        { label: "Engine Visibility", value: fmtDash(t4.summary?.engine_visibility_ratio) },
        { label: "Cited URLs", value: fmtInt(t4.summary?.cited_urls_count) },
        { label: "Cited Search Terms", value: fmtInt(t4.summary?.cited_search_terms_count) },
      ],
    },
    {
      title: "Topic 5 — Paid Visibility",
      score: null,
      stats: [
        { label: "No. of Terms", value: fmtInt(t5.keywords?.total_keywords) },
        { label: "Est. Monthly Spend", value: t5.keywords ? fmtCurrencyGBP(t5.keywords.estimated_monthly_spend) : "–" },
        { label: "Total Monthly Clicks", value: fmtInt(t5.keywords?.total_monthly_clicks) },
      ],
    },
    {
      title: "Topic 6 — Local Visibility",
      score: scoreTopic6(results).score,
      stats: [
        { label: "Avg Map Pack Position", value: fmtDash(t6.map_pack?.average_map_pack_position) },
        { label: "NAP Consistency", value: t6.citations ? fmtPercent(t6.citations.nap_consistency_score) : "–" },
        { label: "Total Reviews", value: fmtInt(t6.reviews?.gbp_metrics?.total_reviews) },
        { label: "Average Rating", value: t6.reviews?.gbp_metrics ? `${t6.reviews.gbp_metrics.average_rating.toFixed(1)} / 5` : "–" },
      ],
    },
    {
      title: "Topic 7 — Onpage Content Quality",
      score: scoreTopic7(results).score,
      stats: [
        { label: "URLs with Thin Content", value: fmtInt(t7.thin_content_analysis?.thin_content_page_count) },
        { label: "Pages Analyzed", value: fmtInt(t7.thin_content_analysis?.total_pages_analyzed) },
        { label: "Unique Forms", value: fmtInt(t7.form_detection?.unique_forms_count) },
      ],
    },
  ];

  for (const section of sections) {
    y = ensureSpace(doc, y, 90);
    y = drawSectionTitle(doc, section.title, y);
    y = drawStatRow(doc, section.stats, y);
    y += 6;
  }

  drawFooters(doc);
  doc.save(`executive-summary-${safeHostname(audit.target_url)}.pdf`);
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "audit";
  }
}
