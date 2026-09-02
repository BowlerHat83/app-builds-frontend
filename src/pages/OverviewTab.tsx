import type { MasterAuditResponse, MasterAuditResults } from "../types/audit";
import Card from "../components/ui/Card";
import GaugeRing from "../components/ui/GaugeRing";
import { fmtInt, fmtPercent, fmtCurrencyGBP, fmtDash } from "../lib/format";
import {
  computeCompositeScore,
  scoreTopic1,
  scoreTopic2,
  scoreTopic3,
  scoreTopic4,
  scoreTopic5,
  scoreTopic6,
  scoreTopic7,
  gradeFromScore,
} from "../lib/scoring";

interface OverviewTabProps {
  audit: MasterAuditResponse;
  onJumpTo: (tabKey: string) => void;
}

// A short, plain-English read on the composite above: which areas are
// strongest/weakest among the topics that had enough real data to score,
// and which topics are missing inputs entirely (so a flat "no PPC data"
// omission doesn't get silently absorbed into the score instead of called
// out). Everything here is derived from the real response - nothing is
// invented if the data isn't there to support a claim.
function buildInsightParagraph(results: MasterAuditResults): string {
  const scored = [
    { key: "Accessibility & Compliance", score: scoreTopic1(results).score },
    { key: "Performance", score: scoreTopic2(results).score },
    { key: "Organic Visibility", score: scoreTopic3(results).score },
    { key: "AI Visibility", score: scoreTopic4(results).score },
    { key: "Local Visibility", score: scoreTopic6(results).score },
    { key: "Onpage Content Quality", score: scoreTopic7(results).score },
  ].filter((t): t is { key: string; score: number } => t.score !== null);

  let strengthsWeaknesses = "";
  if (scored.length >= 2) {
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    strengthsWeaknesses =
      best.key === worst.key
        ? ""
        : ` The strongest area right now is ${best.key} (${Math.round(best.score)}%); the biggest opportunity is ${worst.key} (${Math.round(worst.score)}%).`;
  } else if (scored.length === 1) {
    strengthsWeaknesses = ` Only ${scored[0].key} currently has enough data to score (${Math.round(scored[0].score)}%) — upload more exports to see the full picture.`;
  } else {
    strengthsWeaknesses = " None of the topics have enough data to score yet — upload the relevant exports to see strengths and weaknesses here.";
  }

  const missing: string[] = [];
  const t3 = results.topic3_organic_visibility.data;
  const t4 = results.topic4_ai_visibility.data;
  const t5 = results.topic5_paid_visibility.data;
  const t6 = results.topic6_local_visibility.data;
  if (!t3.backlinks_summary && !t3.top_keywords) missing.push("Organic Visibility (Ahrefs)");
  if (!t4.engine_visibility) missing.push("AI Visibility");
  if (!t5.keywords && !t5.competitor_share) missing.push("Paid Visibility (PPC)");
  if (!t6.citations) missing.push("Local citations (BrightLocal)");

  const omission = missing.length
    ? ` ${missing.join(", ")} ${missing.length === 1 ? "wasn't" : "weren't"} supplied for this audit, so ${
        missing.length === 1 ? "it's" : "they're"
      } shown with partial or no data on ${missing.length === 1 ? "its" : "their"} tab${missing.length === 1 ? "" : "s"} below — and, being N/A rather than a 0, excluded from the composite score entirely rather than dragging it down.`
    : "";

  return `This composite reflects only the topics with real data behind them.${strengthsWeaknesses}${omission}`;
}

export default function OverviewTab({ audit, onJumpTo }: OverviewTabProps) {
  const results = audit.master_audit_results;
  const composite = computeCompositeScore(results);
  const insightParagraph = buildInsightParagraph(results);

  const t1 = results.topic1_technical.data;
  const t2 = results.topic2_performance.data;
  const t3 = results.topic3_organic_visibility.data;
  const t4 = results.topic4_ai_visibility.data;
  const t5 = results.topic5_paid_visibility.data;
  const t6 = results.topic6_local_visibility.data;
  const t7 = results.topic7_content_quality.data;

  const cards = [
    {
      tabKey: "topic1",
      title: "Topic 1: Accessibility & Compliance",
      score: scoreTopic1(results).score,
      pending: results.topic1_technical.status === "pending",
      incomplete: results.topic1_technical.status === "incomplete",
      rows: [
        { label: "Sitemap", value: t1.technical_standards?.sitemap?.found ? "Found" : "Not found" },
        { label: "WCAG Compliant", value: t1.wcag_accessibility ? `${fmtInt(t1.wcag_accessibility.score)}/100` : "–" },
        { label: "GDPR Compliant", value: t1.gdpr_compliance ? (t1.gdpr_compliance.is_gdpr_compliant ? "Yes" : "No") : "–" },
      ],
    },
    {
      tabKey: "topic2",
      title: "Topic 2: Performance",
      score: scoreTopic2(results).score,
      pending: results.topic2_performance.status === "pending",
      incomplete: results.topic2_performance.status === "incomplete",
      rows: [
        { label: "Performance Score (Mobile)", value: t2.core_web_vitals?.mobile?.performance_score != null ? `${t2.core_web_vitals.mobile.performance_score}/100` : "N/A" },
        { label: "Indexation Errors", value: fmtInt(t2.metadata_analysis?.indexation_errors_count) },
        { label: "Missing H1s", value: fmtInt(t2.metadata_analysis?.meta_counts?.missing_h1) },
      ],
    },
    {
      tabKey: "topic3",
      title: "Topic 3: Organic Visibility",
      score: scoreTopic3(results).score,
      pending: results.topic3_organic_visibility.status === "pending",
      incomplete: results.topic3_organic_visibility.status === "incomplete",
      rows: [
        { label: "Backlinks", value: fmtInt(t3.backlinks_summary?.total_backlinks) },
        { label: "Avg Keyword Position", value: fmtDash(t3.keyword_position?.metrics?.average_position) },
        { label: "Est. Monthly Organic Clicks", value: fmtInt(t3.traffic_impressions?.metrics?.estimated_organic_clicks) },
      ],
    },
    {
      tabKey: "topic4",
      title: "Topic 4: AI Visibility",
      score: scoreTopic4(results).score,
      pending: results.topic4_ai_visibility.status === "pending",
      incomplete: results.topic4_ai_visibility.status === "incomplete",
      rows: [
        { label: "Engine Visibility", value: fmtDash(t4.summary?.engine_visibility_ratio) },
        { label: "Cited URLs", value: fmtInt(t4.summary?.cited_urls_count) },
        { label: "Cited Search Terms", value: fmtInt(t4.summary?.cited_search_terms_count) },
      ],
    },
    {
      tabKey: "topic5",
      title: "Topic 5: Paid Visibility",
      // Not a "good/bad" score like the other topics (see scoring.ts) -
      // this reflects how much substantive PPC data actually came back,
      // so a thin result (few keywords, no real spend signal) shows as a
      // low score instead of a blank gauge, and no data at all still
      // reads as N/A.
      score: scoreTopic5(results).score,
      pending: results.topic5_paid_visibility.status === "pending",
      incomplete: results.topic5_paid_visibility.status === "incomplete",
      rows: [
        { label: "No. of Terms", value: fmtInt(t5.keywords?.total_keywords) },
        { label: "Est. Monthly Spend", value: t5.keywords ? fmtCurrencyGBP(t5.keywords.estimated_monthly_spend) : "–" },
      ],
    },
    {
      tabKey: "topic6",
      title: "Topic 6: Local Visibility",
      score: scoreTopic6(results).score,
      highlight: true,
      pending: results.topic6_local_visibility.status === "pending",
      incomplete: results.topic6_local_visibility.status === "incomplete",
      rows: [
        { label: "Avg Map Pack Position", value: fmtDash(t6.map_pack?.average_map_pack_position) },
        { label: "No. of Citations", value: fmtInt(t6.citations?.total_citations) },
        { label: "NAP Consistency", value: t6.citations ? fmtPercent(t6.citations.nap_consistency_score) : "–" },
      ],
    },
    {
      tabKey: "topic7",
      title: "Topic 7: Onpage Content Quality",
      score: scoreTopic7(results).score,
      pending: results.topic7_content_quality.status === "pending",
      incomplete: results.topic7_content_quality.status === "incomplete",
      rows: [
        { label: "URLs with Thin Content", value: fmtInt(t7.thin_content_analysis?.thin_content_page_count) },
        { label: "Unique Forms", value: fmtInt(t7.form_detection?.unique_forms_count) },
      ],
    },
  ];

  return (
    <div className="stack">
      <Card>
        <div className="overview-header">
          <div>
            <h1>Full Audit Executive Summary</h1>
            <div className="target-url">
              Target URL:{" "}
              <a href={audit.target_url} target="_blank" rel="noreferrer">
                {audit.target_url}
              </a>
            </div>
          </div>
          <div className="score-block">
            <div className="score-item">
              <span className="score-item-label">Composite Grade</span>
              <span
                className="grade-pill"
                style={{
                  color: audit.complete !== false ? composite.gradeColor : "var(--text-tertiary)",
                  background: "transparent",
                  borderColor: audit.complete !== false ? composite.gradeColor : "var(--border-strong)",
                }}
              >
                {audit.complete !== false ? composite.grade : "–"}
              </span>
            </div>
            <div className="score-item">
              <span className="score-item-label">Composite Score</span>
              <span className="score-item-value">{audit.complete !== false && composite.score !== null ? `${composite.score}%` : "–"}</span>
            </div>
          </div>
        </div>
        {audit.complete !== false ? (
          <p className="overview-summary-text">{insightParagraph}</p>
        ) : (
          <p className="overview-summary-text overview-summary-pending">
            <span className="spinner" /> Waiting on the remaining topics to finish before summarizing — the topic
            cards below will fill in as each one completes.
          </p>
        )}
      </Card>

      <div className="grid grid-2">
        {cards.map((c) => (
          <div key={c.tabKey} className={`card overview-topic-card ${c.highlight ? "card-accent" : ""}`} onClick={() => onJumpTo(c.tabKey)}>
            <div style={{ flex: 1 }}>
              <h3>
                {c.title}
                {c.incomplete && (
                  <span className="incomplete-marker" title="Didn't finish this run - see this topic's tab for details">
                    {" "}
                    *
                  </span>
                )}
              </h3>
              <ul>
                {c.rows.map((r, i) => (
                  <li key={i}>
                    {r.label}: <b>{r.value}</b>
                  </li>
                ))}
              </ul>
            </div>
            <GaugeRing loading={c.pending} value={c.score} size={64} strokeWidth={6} color={gradeFromScore(c.score).color} />
          </div>
        ))}
      </div>
      {cards.some((c) => c.incomplete) && (
        <p className="note-text">
          * This topic didn't finish during this run and is excluded from the composite score above (shown as N/A,
          not a 0) - see its tab for what happened.
        </p>
      )}
    </div>
  );
}
