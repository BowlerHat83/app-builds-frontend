// Every score computed here is a frontend-side composite derived from real
// fields in the audit response - the backend never returns a single 0-100
// "topic score" for most topics, so this is clearly a derived estimate, not
// raw API data. Any topic where the underlying numbers don't support a
// meaningful good/bad direction (Topic 5: more paid spend isn't inherently
// good or bad) is left out of the composite rather than guessed. Topic 5
// still gets its own scoreTopic5() below for its card on the overview grid
// - that one measures how much substantive PPC data actually came back
// (not whether the spend is "good"), so a handful of keywords with no real
// spend behind them reads as a low score rather than a blank one.

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
    if (data.technical_standards?.sitemap?.found === false) score -= 8;
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
  const kp = results.topic3_organic_visibility?.data?.keyword_position?.metrics;
  if (!kp || !kp.total_keywords_analyzed) return { score: null, label: "Organic Visibility" };
  const top10Rate = (kp.top_10_count / kp.total_keywords_analyzed) * 100;
  const positionScore = clamp(100 - kp.average_position * 3);
  const score = clamp((top10Rate + positionScore) / 2);
  return { score, label: "Organic Visibility" };
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
  if (!data) return { score: null, label: "AI Visibility" };

  const parts: (number | null)[] = [];

  const ratio = data.summary?.engine_visibility_ratio;
  if (ratio) {
    const [num, den] = ratio.split("/").map((n) => parseFloat(n));
    parts.push(den ? clamp((num / den) * 100) : null);
  } else {
    parts.push(null);
  }

  const targetUrls = data.top_target_urls;
  if (targetUrls && targetUrls.total_citation_rows !== undefined) {
    // 10+ citation rows against the target's own pages is treated as
    // strong depth; scales down linearly from there.
    parts.push(clamp((targetUrls.total_citation_rows / 10) * 100));
  } else {
    parts.push(null);
  }

  const searchTerms = data.top_search_terms;
  if (searchTerms && searchTerms.top_search_terms !== undefined) {
    // Capped at the top 10 prompts returned, so this maxes out once 10
    // distinct real prompts surfaced the site rather than requiring an
    // arbitrarily larger count.
    parts.push(clamp((searchTerms.top_search_terms.length / 10) * 100));
  } else {
    parts.push(null);
  }

  const score = average(parts);
  return { score: score !== null ? clamp(score) : null, label: "AI Visibility" };
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
  if (!kw && !comp) return { score: null, label: "No data" };

  const parts: number[] = [];

  if (kw) {
    // 20+ tracked keywords is treated as strong coverage; scales down
    // linearly from there rather than requiring an arbitrary "good" count.
    parts.push(clamp(((kw.total_keywords ?? 0) / 20) * 100));
    // Whether real budget/CPC data came back at all - not whether the
    // figure itself is high or low, since spend level isn't a quality
    // signal, only its presence is.
    const hasSpendSignal = (kw.estimated_monthly_spend ?? 0) > 0 || (kw.average_cpc ?? 0) > 0;
    parts.push(hasSpendSignal ? 100 : 0);
  }

  if (comp) {
    // 5+ competitors analyzed is treated as strong coverage, same scaling
    // logic as keyword coverage above.
    parts.push(clamp(((comp.total_competitors_analyzed ?? 0) / 5) * 100));
  }

  const score = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  return { score, label: "Paid Data Completeness" };
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
