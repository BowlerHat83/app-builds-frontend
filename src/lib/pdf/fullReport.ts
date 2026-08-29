import type { MasterAuditResponse } from "../../types/audit";
import { computeCompositeScore } from "../scoring";
import { fmtInt, fmtPercent, fmtCurrencyGBP, fmtDash, fmtMs, truncate } from "../format";
import {
  newDoc,
  drawCoverBrandHeader,
  drawSectionTitle,
  drawSubLabel,
  drawStatRow,
  drawTable,
  drawEmptyNote,
  ensureSpace,
  drawFooters,
  PAGE,
  StatItem,
} from "./pdfHelpers";
import { RowInput } from "jspdf-autotable";

const MAX_ROWS = 40;

function capNote(total: number, shown: number, label: string): string | null {
  return total > shown ? `Showing ${shown} of ${total} ${label} — see the full list in the dashboard.` : null;
}

export async function generateFullReportPdf(audit: MasterAuditResponse): Promise<void> {
  const doc = newDoc();
  const r = audit.master_audit_results;
  const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  let y = await drawCoverBrandHeader(doc, audit.target_url, generatedAt);
  const composite = computeCompositeScore(r);

  doc.setFontSize(11);
  doc.setTextColor(20, 24, 38);
  doc.text(`Composite Grade: ${composite.grade}   ·   Composite Score: ${composite.score !== null ? `${composite.score}%` : "–"}`, PAGE.margin, y);
  y += 26;

  // ---------------- Topic 1 ----------------
  const t1 = r.topic1_technical.data;
  y = drawSectionTitle(doc, "Topic 1: Accessibility & Compliance", y);
  y = drawStatRow(
    doc,
    [
      { label: "Sitemap URLs", value: fmtInt(t1.technical_standards?.sitemap?.url_count) },
      { label: "SSL Days Remaining", value: fmtInt(t1.technical_standards?.ssl_certificate?.days_remaining) },
      { label: "HTML Errors", value: fmtInt(t1.technical_standards?.html_syntax?.total_errors) },
      { label: "WCAG Score", value: t1.wcag_accessibility ? `${fmtInt(t1.wcag_accessibility.score)}/100` : "–" },
    ],
    y
  );
  y = drawSubLabel(doc, "WCAG Issues", y);
  if (t1.wcag_accessibility?.issues?.length) {
    const rows: RowInput[] = t1.wcag_accessibility.issues.slice(0, MAX_ROWS).map((i) => [i.code, truncate(i.description, 60), i.impact, truncate(i.element, 40)]);
    y = drawTable(doc, y, ["Code", "Description", "Impact", "Element"], rows);
    const note = capNote(t1.wcag_accessibility.issues.length, Math.min(MAX_ROWS, t1.wcag_accessibility.issues.length), "issues");
    if (note) y = drawEmptyNote(doc, note, y);
  } else {
    y = drawEmptyNote(doc, "No WCAG issues detected.", y);
  }

  y = ensureSpace(doc, y, 60);
  y = drawSubLabel(doc, `GDPR & Cookies (${t1.gdpr_compliance?.is_gdpr_compliant ? "compliant" : "non-compliant"}, score ${fmtInt(t1.gdpr_compliance?.score)}/100)`, y);
  if (t1.gdpr_compliance?.cookies_detected?.length) {
    const rows: RowInput[] = t1.gdpr_compliance.cookies_detected.slice(0, MAX_ROWS).map((c) => [c.name, c.domain, c.path, c.secure]);
    y = drawTable(doc, y, ["Cookie", "Domain", "Path", "Secure"], rows);
    const note = capNote(t1.gdpr_compliance.cookies_detected.length, Math.min(MAX_ROWS, t1.gdpr_compliance.cookies_detected.length), "cookies");
    if (note) y = drawEmptyNote(doc, note, y);
  } else {
    y = drawEmptyNote(doc, "No cookies detected.", y);
  }

  // ---------------- Topic 2 ----------------
  doc.addPage();
  y = PAGE.margin;
  const t2 = r.topic2_performance.data;
  y = drawSectionTitle(doc, "Topic 2: Performance", y);
  const cwvMobile = t2.core_web_vitals?.mobile;
  const cwvDesktop = t2.core_web_vitals?.desktop;
  const perfStats: StatItem[] = [
    { label: "Performance Score (Mobile)", value: cwvMobile?.performance_score != null ? `${cwvMobile.performance_score}/100` : "N/A" },
    { label: "Performance Score (Desktop)", value: cwvDesktop?.performance_score != null ? `${cwvDesktop.performance_score}/100` : "N/A" },
    { label: "LCP (Mobile)", value: fmtMs(cwvMobile?.lcp_ms ?? null) },
    { label: "LCP (Desktop)", value: fmtMs(cwvDesktop?.lcp_ms ?? null) },
    { label: "CLS (Mobile)", value: cwvMobile?.cls != null ? cwvMobile.cls.toFixed(3) : "–" },
    { label: "Total Blocking Time (Mobile)", value: fmtMs(cwvMobile?.total_blocking_time_ms ?? null) },
    { label: "Page Size", value: t2.tech_metrics?.page_size_kb != null ? `${t2.tech_metrics.page_size_kb} KB` : "–" },
    { label: "Load Time", value: fmtMs(t2.tech_metrics?.load_time_ms ?? null) },
    { label: "Status Code", value: fmtDash(t2.tech_metrics?.status_code) },
    { label: "Indexation Errors", value: fmtInt(t2.metadata_analysis?.indexation_errors_count) },
  ];
  y = drawStatRow(doc, perfStats, y);
  y = drawSubLabel(doc, "Metadata", y);
  y = drawTable(
    doc,
    y,
    ["Element", "Missing", "Duplicate", "Multiple"],
    [
      ["Title Tags", fmtInt(t2.metadata_analysis?.meta_counts?.title?.missing), fmtInt(t2.metadata_analysis?.meta_counts?.title?.duplicate), fmtInt(t2.metadata_analysis?.meta_counts?.title?.multiple)],
      ["Meta Descriptions", fmtInt(t2.metadata_analysis?.meta_counts?.description?.missing), fmtInt(t2.metadata_analysis?.meta_counts?.description?.duplicate), fmtInt(t2.metadata_analysis?.meta_counts?.description?.multiple)],
    ]
  );

  // ---------------- Topic 3 ----------------
  doc.addPage();
  y = PAGE.margin;
  const t3 = r.topic3_organic_visibility.data;
  y = drawSectionTitle(doc, "Topic 3: Organic Visibility", y);
  y = drawStatRow(
    doc,
    [
      { label: "Backlinks", value: fmtInt(t3.backlinks_summary?.total_backlinks) },
      { label: "Referring Domains", value: fmtInt(t3.backlinks_summary?.unique_referring_domains) },
      { label: "Avg Keyword Position", value: fmtDash(t3.keyword_position?.metrics?.average_position) },
      { label: "Top 10 Keywords", value: fmtInt(t3.keyword_position?.metrics?.top_10_count) },
    ],
    y
  );
  y = drawSubLabel(doc, "Top Competitors (Domain Rating)", y);
  if (t3.domain_rating?.top_competitors?.length) {
    y = drawTable(doc, y, ["Domain", "Domain Rating"], t3.domain_rating.top_competitors.map((c) => [c.domain, fmtInt(c.dr)]));
  } else {
    y = drawEmptyNote(doc, "No competitor data available.", y);
  }

  y = ensureSpace(doc, y, 60);
  y = drawSubLabel(doc, "Top Keywords", y);
  if (t3.top_keywords?.top_keywords?.length) {
    y = drawTable(
      doc,
      y,
      ["Keyword", "Imp/mo", "Clicks", "Position"],
      t3.top_keywords.top_keywords.slice(0, MAX_ROWS).map((k) => [k.keyword, fmtInt(k.impressions_volume), fmtInt(k.estimated_clicks), fmtDash(k.average_position)])
    );
  } else {
    y = drawEmptyNote(doc, "No keyword data available.", y);
  }

  y = ensureSpace(doc, y, 60);
  y = drawSubLabel(doc, "Content Gaps", y);
  if (t3.content_gaps?.content_gaps?.length) {
    y = drawTable(
      doc,
      y,
      ["Keyword", "Est. Volume", "Difficulty", "Current Position", "Priority"],
      t3.content_gaps.content_gaps.slice(0, MAX_ROWS).map((g) => [g.keyword, fmtInt(g.search_volume), fmtInt(g.keyword_difficulty), String(g.current_position), g.opportunity_priority])
    );
  } else {
    y = drawEmptyNote(doc, "No content gap data available.", y);
  }

  // ---------------- Topic 4 ----------------
  doc.addPage();
  y = PAGE.margin;
  const t4 = r.topic4_ai_visibility.data;
  y = drawSectionTitle(doc, "Topic 4: AI Visibility", y);
  y = drawStatRow(
    doc,
    [
      { label: "Engine Visibility", value: fmtDash(t4.summary?.engine_visibility_ratio) },
      { label: "Cited URLs", value: fmtInt(t4.summary?.cited_urls_count) },
      { label: "Cited Search Terms", value: fmtInt(t4.summary?.cited_search_terms_count) },
    ],
    y
  );
  y = drawSubLabel(doc, "Engine Breakdown", y);
  if (t4.engine_visibility?.engine_visibility_breakdown?.length) {
    y = drawTable(
      doc,
      y,
      ["Engine", "Keyword Count", "Source Count"],
      t4.engine_visibility.engine_visibility_breakdown.map((e) => [e.engine, fmtInt(e.keyword_count), fmtInt(e.source_count)])
    );
  } else {
    y = drawEmptyNote(doc, "No engine visibility data available.", y);
  }

  y = ensureSpace(doc, y, 60);
  y = drawSubLabel(doc, "Top Cited Sources", y);
  if (t4.top_urls?.top_brand_sources?.length) {
    y = drawTable(
      doc,
      y,
      ["Domain", "Category", "Citations", "Sample URL"],
      t4.top_urls.top_brand_sources.slice(0, MAX_ROWS).map((s) => [s.source_domain, s.category, fmtInt(s.total_citations), truncate(s.key_urls?.[0], 44)])
    );
  } else {
    y = drawEmptyNote(doc, "No cited source data available.", y);
  }

  // ---------------- Topic 5 ----------------
  doc.addPage();
  y = PAGE.margin;
  const t5 = r.topic5_paid_visibility.data;
  y = drawSectionTitle(doc, "Topic 5: Paid Visibility", y);
  y = drawStatRow(
    doc,
    [
      { label: "No. of Keywords", value: fmtInt(t5.keywords?.total_keywords) },
      { label: "Est. Monthly Spend", value: t5.keywords ? fmtCurrencyGBP(t5.keywords.estimated_monthly_spend) : "–" },
      { label: "Average CPC", value: t5.keywords?.average_cpc != null ? fmtCurrencyGBP(t5.keywords.average_cpc) : "–" },
      { label: "Total Monthly Clicks", value: fmtInt(t5.keywords?.total_monthly_clicks) },
    ],
    y
  );
  y = drawSubLabel(doc, "Competitor Share", y);
  if (t5.competitor_share?.competitor_share_breakdown?.length) {
    y = drawTable(
      doc,
      y,
      ["Domain", "Common KW", "Paid Keywords", "Paid Clicks", "Ad Budget"],
      t5.competitor_share.competitor_share_breakdown.map((c) => [c.domain, fmtInt(c.common_keywords), fmtInt(c.monthly_paid_keywords), fmtInt(c.monthly_paid_clicks), fmtCurrencyGBP(c.monthly_ad_budget)])
    );
  } else {
    y = drawEmptyNote(doc, "No competitor spend data available.", y);
  }

  y = ensureSpace(doc, y, 60);
  y = drawSubLabel(doc, "Top Keywords", y);
  if (t5.keywords?.top_keywords?.length) {
    y = drawTable(doc, y, ["Keyword", "Est. Volume", "CPC"], t5.keywords.top_keywords.map((k) => [k.keyword, fmtInt(k.search_volume), fmtCurrencyGBP(k.cpc)]));
  } else {
    y = drawEmptyNote(doc, "No PPC keyword data available.", y);
  }

  // ---------------- Topic 6 ----------------
  doc.addPage();
  y = PAGE.margin;
  const t6 = r.topic6_local_visibility.data;
  y = drawSectionTitle(doc, "Topic 6: Local Visibility", y);
  y = drawStatRow(
    doc,
    [
      { label: "NAP Consistency", value: t6.citations ? fmtPercent(t6.citations.nap_consistency_score) : "–" },
      { label: "Total Citations", value: fmtInt(t6.citations?.total_citations) },
      { label: "Avg Map Pack Position", value: fmtDash(t6.map_pack?.average_map_pack_position) },
      { label: "Total Reviews", value: fmtInt(t6.reviews?.gbp_metrics?.total_reviews) },
      { label: "Average Rating", value: t6.reviews?.gbp_metrics ? `${t6.reviews.gbp_metrics.average_rating.toFixed(1)} / 5` : "–" },
    ],
    y
  );
  y = drawSubLabel(doc, "Map Pack Keyword Breakdown", y);
  if (t6.map_pack?.keyword_breakdown?.length) {
    y = drawTable(
      doc,
      y,
      ["Keyword", "Map Pack Position"],
      t6.map_pack.keyword_breakdown.map((k) => [
        k.keyword,
        k.in_map_pack ? `#${k.local_pack_position}` : k.found ? `#${k.local_pack_position} (local results, not in 3-pack)` : "Not found",
      ])
    );
  } else {
    y = drawEmptyNote(doc, "No map-pack data available.", y);
  }

  y = ensureSpace(doc, y, 60);
  y = drawSubLabel(doc, "Top Reviews", y);
  if (t6.reviews?.top_reviews?.length) {
    y = drawTable(
      doc,
      y,
      ["Author", "Rating", "Date", "Review"],
      t6.reviews.top_reviews.map((rv) => [rv.author, `${rv.rating}★`, rv.date, truncate(rv.snippet, 90)])
    );
  } else {
    y = drawEmptyNote(doc, t6.reviews?.note ?? t6.reviews?.error ?? "No review data available.", y);
  }

  // ---------------- Topic 7 ----------------
  doc.addPage();
  y = PAGE.margin;
  const t7 = r.topic7_content_quality.data;
  y = drawSectionTitle(doc, "Topic 7: Onpage Content Quality", y);
  y = drawStatRow(
    doc,
    [
      { label: "Unique Forms", value: fmtInt(t7.form_detection?.unique_forms_count) },
      { label: "Total Form Instances", value: fmtInt(t7.form_detection?.total_forms_found) },
      { label: "Thin Content URLs", value: fmtInt(t7.thin_content_analysis?.thin_content_page_count) },
      { label: "Pages Analyzed", value: fmtInt(t7.thin_content_analysis?.total_pages_analyzed) },
    ],
    y
  );
  y = drawSubLabel(doc, "Forms Detected", y);
  if (t7.form_detection?.unique_forms?.length) {
    y = drawTable(
      doc,
      y,
      ["First Seen URL", "Occurrences", "Total Inputs"],
      t7.form_detection.unique_forms.map((f) => [truncate(f.first_seen_url, 55), fmtInt(f.occurrence_count), fmtInt(f.total_inputs)])
    );
  } else {
    y = drawEmptyNote(doc, "No forms detected.", y);
  }

  y = ensureSpace(doc, y, 60);
  y = drawSubLabel(doc, "Thin Content Pages", y);
  if (t7.thin_content_analysis?.page_details?.length) {
    const rows = t7.thin_content_analysis.page_details.slice(0, MAX_ROWS);
    y = drawTable(doc, y, ["URL", "Words", "Thin?"], rows.map((p) => [truncate(p.url, 55), fmtInt(p.word_count), p.is_thin ? "Yes" : "No"]));
    const note = capNote(t7.thin_content_analysis.page_details.length, rows.length, "pages");
    if (note) y = drawEmptyNote(doc, note, y);
  } else {
    y = drawEmptyNote(doc, "No page-level content data available.", y);
  }

  drawFooters(doc);
  doc.save(`full-report-${safeHostname(audit.target_url)}.pdf`);
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "audit";
  }
}
