// Every score computed here is a frontend-side composite derived from real
// fields in the audit response - the backend never returns a single 0-100
// "topic score" for most topics, so this is clearly a derived estimate, not
// raw API data. A topic (or a signal within it) only ever scores off data
// that was both supplied AND successfully gathered - a failed live check
// (a timed-out sitemap fetch, a SerpApi error response) is excluded from
// the average the same way a CSV that was never uploaded is, never scored
// as if it were a real negative result. Topic 5 (Paid Visibility) measures
// the target's own PPC coverage/spend/clicks against the average of its
// tracked competitors - genuinely requires both the keywords and
// competitors exports, so it scores null (N/A) with only one of the two,
// rather than falling back to a data-completeness measure.

import type { MasterAuditResults } from "../types/audit";

export interface TopicScore {
  score: number | null; // 0-100, or null if not enough data to score
  label: string;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

export function scoreTopic1(results: MasterAuditResults): TopicScore {
  const data = results.topic1_technical?.data;
  if (!data) return { score: null, label: "No data" };
  const wcag = data.wcag_accessibility?.score ?? null;
  const gdpr = data.gdpr_compliance?.score ?? null;
  let score = average([wcag, gdpr]);
  if (score !== null) {
    const sitemap = data.technical_standards?.sitemap;
    if (sitemap?.found === false && sitemap?.check_failed !== true) score -= 8;
    if (data.technical_standards?.ssl_certificate?.is_expired) score -= 20;
    if (data.technical_standards?.html_syntax?.is_valid === false) score -= 5;
    score = clamp(score);
  }
  return { score, label: "Accessibility & Compliance" };
}

// Three independent signals, each present-or-excluded on its own (see
// average() below) rather than one dominating the others:
//   - Core Web Vitals: Lighthouse's own 0-100 performance score, averaged
//     across mobile AND desktop where both ran - previously this was
//     scored off the mobile run alone (Google's own mobile-first
//     convention), which meant a desktop-only regression never touched the
//     score at all even though the Topic 2 tab shows both runs in full.
//   - Indexation health: what share of every crawled URL (Screaming
//     Frog's total_urls_analyzed) came back marked non-indexable, as a
//     straight 100-minus-percentage the same way scoreTopic7 turns thin-
//     content rate into a score below.
//   - Metadata hygiene: missing/duplicate/multiple title and description
//     tags, each as their own share of total_urls_analyzed (a page can
//     rack up more than one of the six categories at once - e.g. missing
//     AND duplicate H1s is nonsensical but missing title + missing
//     description isn't - so this averages the six per-category rates
//     rather than summing raw counts, which would double-penalize pages
//     with multiple simultaneous issues and could exceed 100%).
export function scoreTopic2(results: MasterAuditResults): TopicScore {
  const data = results.topic2_performance?.data;
  if (!data) return { score: null, label: "Performance" };

  const parts: (number | null)[] = [];

  const cwvScores = [data.core_web_vitals?.mobile?.performance_score, data.core_web_vitals?.desktop?.performance_score].filter(
    (s): s is number => s != null
  );
  parts.push(cwvScores.length ? cwvScores.reduce((a, b) => a + b, 0) / cwvScores.length : null);

  const meta = data.metadata_analysis;
  const totalUrls = meta?.total_urls_analyzed ?? 0;

  if (meta && totalUrls > 0 && meta.indexation_errors_count != null) {
    const errorRate = clamp((meta.indexation_errors_count / totalUrls) * 100);
    parts.push(clamp(100 - errorRate));
  } else {
    parts.push(null);
  }

  if (meta && totalUrls > 0) {
    const categoryCounts = [
      meta.meta_counts.title.missing,
      meta.meta_counts.title.duplicate,
      meta.meta_counts.title.multiple,
      meta.meta_counts.description.missing,
      meta.meta_counts.description.duplicate,
      meta.meta_counts.description.multiple,
    ];
    const categoryRates = categoryCounts
      .filter((c): c is number => c != null)
      .map((c) => clamp((c / totalUrls) * 100));
    if (categoryRates.length) {
      const avgIssueRate = categoryRates.reduce((a, b) => a + b, 0) / categoryRates.length;
      parts.push(clamp(100 - avgIssueRate));
    } else {
      parts.push(null);
    }
  } else {
    parts.push(null);
  }

  const score = average(parts);
  return { score: score !== null ? clamp(score) : null, label: "Performance" };
}

export function scoreTopic3(results: MasterAuditResults): TopicScore {
  const data = results.topic3_organic_visibility?.data;
  const label = "Organic Visibility";
  if (!data) return { score: null, label };
  const parts: (number | null)[] = [];

  const kp = data.keyword_position?.metrics;
  let keywordScore: number | null = null;
  if (kp && kp.total_keywords_analyzed) {
    const top10Rate = (kp.top_10_count / kp.total_keywords_analyzed) * 100;
    const positionScore = clamp(100 - kp.average_position * 3);
    keywordScore = clamp((top10Rate + positionScore) / 2);
  }

  const drMetrics = data.domain_rating?.metrics;
  if (keywordScore !== null && drMetrics && drMetrics.average_competitor_dr != null) {
    const drDelta = drMetrics.average_competitor_dr - 50;
    const adjustment = clamp(drDelta * 0.2, -10, 10);
    keywordScore = clamp(keywordScore + adjustment);
  }
  parts.push(keywordScore);

  const bl = data.backlinks_summary;
  if (bl && bl.total_backlinks > 0) {
    const domainBreadth = clamp((bl.unique_referring_domains / 30) * 100);
    const dofollowRatio = clamp((bl.dofollow_backlinks / bl.total_backlinks) * 100);
    parts.push((domainBreadth + dofollowRatio) / 2);
  } else {
    parts.push(null);
  }

  const score = average(parts);
  return { score: score !== null ? clamp(score) : null, label };
}

// Being cited across all 4 tracked engines is a useful signal, but on its
// own it only says "an engine mentioned the domain somewhere" - it doesn't
// say whether that's one thin mention or a real pattern, so it isn't
// allowed to be the sole determinant of this score. Three signals are
// averaged instead: (a) engine-visibility ratio itself, (b) depth - how
// many actual citation rows the target's own pages picked up, not just
// whether they were mentioned once, and (c) breadth - how many distinct
// real search prompts actually surfaced the site. Each signal uses
// `!== undefined` rather than `??` so a genuine 0 from a block that DID run
// (e.g. the facts CSV parsed fine but no prompts matched) still counts as a
// real, low score - only a block that never ran at all (no CSV uploaded,
// no target_url to scope to) is excluded from the average entirely.
export function scoreTopic4(results: MasterAuditResults): TopicScore {
  const data = results.topic4_ai_visibility?.data;
  const label = "AI Visibility";
  if (!data) return { score: null, label };

  const parts: (number | null)[] = [];

  const ratio = data.summary?.engine_visibility_ratio;
  if (ratio) {
    const [num, den] = ratio.split("/").map((n) => parseFloat(n));
    parts.push(den ? clamp((num / den) * 100) : null);
  } else {
    parts.push(null);
  }

  // Diminishing-returns curve instead of a hard linear cap: approaches but
  // never fully plateaus at 100, so a result dramatically better than
  // "solid" can still show it instead of reading identically to a
  // merely-decent one. saturationScale is the count at which this reaches
  // ~63/100 - tune if real-world runs show it's calibrated too high/low.
  const diminishing = (count: number | null | undefined, saturationScale: number): number | null => {
    if (count == null || count < 0) return null;
    return clamp(100 * (1 - Math.exp(-count / saturationScale)));
  };

  const targetUrls = data.top_target_urls;
  parts.push(
    targetUrls && targetUrls.total_citation_rows !== undefined
      ? diminishing(targetUrls.total_citation_rows, 15)
      : null
  );

  // cited_search_terms_count (data.summary) is the real, untruncated count
  // of distinct prompts that surfaced the site, computed straight from the
  // facts CSV. top_search_terms.top_search_terms is a DISPLAY list the
  // backend caps at 10 rows - scoring off its .length meant this part hit
  // exactly 100 the instant there were 10+ real matches, since the list
  // itself could never be longer than 10. It wasn't measuring breadth, it
  // was measuring "did the truncation kick in." Uses the real count instead.
  parts.push(
    data.summary?.cited_search_terms_count !== undefined
      ? diminishing(data.summary.cited_search_terms_count, 15)
      : null
  );

  const score = average(parts);
  return { score: score !== null ? clamp(score) : null, label };
}

export function scoreTopic6(results: MasterAuditResults): TopicScore {
  const data = results.topic6_local_visibility?.data;
  if (!data) return { score: null, label: "Local Visibility" };
  const nap = data.citations?.nap_consistency_score ?? null;
  const ratingScore = data.reviews?.gbp_metrics?.average_rating != null ? data.reviews.gbp_metrics.average_rating * 20 : null;
  const mapPos = data.map_pack?.average_map_pack_position ?? null;
  const mapScore = mapPos != null ? clamp(100 - (mapPos - 1) * 15) : null;
  const score = average([nap, ratingScore, mapScore]);
  return { score: score !== null ? clamp(score) : null, label: "Local Visibility" };
}

export function scoreTopic7(results: MasterAuditResults): TopicScore {
  const pct = results.topic7_content_quality?.data?.thin_content_analysis?.thin_content_percentage;
  if (pct === undefined || pct === null) return { score: null, label: "Onpage Content Quality" };
  return { score: clamp(100 - pct), label: "Onpage Content Quality" };
}

// Deliberately not a "good/bad" score - see the file header. This measures
// how much substantive paid-search data the audit actually turned up: real
// keyword coverage, a real spend/CPC signal, and real competitor coverage.
// No data at all (both blocks null/absent) is "No data" (N/A on the card).
// Data that came back thin - a few keywords with no spend or CPC behind
// them - scores low rather than showing blank, since that's a genuinely
// weak result, not a missing one.
export function scoreTopic5(results: MasterAuditResults): TopicScore {
  const data = results.topic5_paid_visibility?.data;
  const kw = data?.keywords;
  const comp = data?.competitor_share;
  const label = "Paid Search Competitive Standing";
  if (!kw || !comp || !comp.competitor_share_breakdown?.length) return { score: null, label };

  const meanOf = (values: (number | null | undefined)[]): number | null => {
    const present = values.filter((v): v is number => v != null && !Number.isNaN(v) && v > 0);
    if (!present.length) return null;
    return present.reduce((a, b) => a + b, 0) / present.length;
  };

  const avgCompetitorKeywords = meanOf(comp.competitor_share_breakdown.map((c) => c.monthly_paid_keywords));
  const avgCompetitorClicks = meanOf(comp.competitor_share_breakdown.map((c) => c.monthly_paid_clicks));
  const avgCompetitorBudget = meanOf(comp.competitor_share_breakdown.map((c) => c.monthly_ad_budget));

  const ratioScore = (own: number | null | undefined, competitorAvg: number | null): number | null => {
    if (own == null || competitorAvg == null || competitorAvg <= 0) return null;
    return clamp((own / competitorAvg) * 50);
  };

  const parts = [
    ratioScore(kw.total_keywords, avgCompetitorKeywords),
    ratioScore(kw.total_monthly_clicks, avgCompetitorClicks),
    ratioScore(kw.estimated_monthly_spend, avgCompetitorBudget),
  ];

  const score = average(parts);
  return { score: score !== null ? clamp(score) : null, label };
}

export interface CompositeScore {
  score: number | null;
  grade: string;
  gradeColor: string;
}

export function gradeFromScore(score: number | null): { grade: string; color: string } {
  if (score === null) return { grade: "–", color: "var(--text-tertiary)" };
  if (score >= 90) return { grade: "A", color: "var(--accent)" };
  if (score >= 80) return { grade: "B+", color: "var(--accent)" };
  if (score >= 70) return { grade: "B", color: "var(--accent-amber)" };
  if (score >= 60) return { grade: "C", color: "var(--accent-amber)" };
  if (score >= 50) return { grade: "D", color: "var(--accent-orange)" };
  return { grade: "F", color: "var(--accent-red)" };
}

// A topic with no real data behind it (score === null, i.e. "N/A") is not
// the same thing as a topic that scored 0 - it's an absent input, not a
// zero result, and shouldn't be able to drag the composite down just
// because a CSV wasn't uploaded for that run. So this is a plain average
// of whichever topics actually have a score: each null is dropped from
// both the sum and the denominator entirely (never counted, never
// zeroed), and the denominator shrinks to match. A topic resumes counting
// as soon as it has real data again - nothing here is topic-specific.
// Topic 5 is included on the same footing as the rest even though its
// score measures data completeness rather than a "good/bad" direction
// (see scoreTopic5 above) - when it has data it counts like any other
// topic; when it doesn't, it's excluded like any other topic.
// If literally every topic is N/A, the composite itself is null (shown as
// "-") rather than a misleading 0%.
export function computeCompositeScore(results: MasterAuditResults): CompositeScore {
  const scores = [
    scoreTopic1(results).score,
    scoreTopic2(results).score,
    scoreTopic3(results).score,
    scoreTopic4(results).score,
    scoreTopic5(results).score,
    scoreTopic6(results).score,
    scoreTopic7(results).score,
  ];
  const present = scores.filter((s): s is number => s !== null);
  const rounded = present.length ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : null;
  const { grade, color } = gradeFromScore(rounded);
  return { score: rounded, grade, gradeColor: color };
}
