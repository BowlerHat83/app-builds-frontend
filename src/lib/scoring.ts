// Every score computed here is a frontend-side composite derived from real
// fields in the audit response - the backend never returns a single 0-100
// "topic score" for most topics, so this is clearly a derived estimate, not
// raw API data. Any topic where the underlying numbers don't support a
// meaningful good/bad direction (Topic 5: more paid spend isn't inherently
// good or bad) is left out of the composite rather than guessed.

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

export function scoreTopic2(results: MasterAuditResults): TopicScore {
  const cwv = results.topic2_performance?.data?.core_web_vitals;
  const score = cwv?.performance_score ?? null;
  return { score, label: "Performance" };
}

export function scoreTopic3(results: MasterAuditResults): TopicScore {
  const kp = results.topic3_organic_visibility?.data?.keyword_position?.metrics;
  if (!kp || !kp.total_keywords_analyzed) return { score: null, label: "Organic Visibility" };
  const top10Rate = (kp.top_10_count / kp.total_keywords_analyzed) * 100;
  const positionScore = clamp(100 - kp.average_position * 3);
  const score = clamp((top10Rate + positionScore) / 2);
  return { score, label: "Organic Visibility" };
}

export function scoreTopic4(results: MasterAuditResults): TopicScore {
  const ratio = results.topic4_ai_visibility?.data?.summary?.engine_visibility_ratio;
  if (!ratio) return { score: null, label: "AI Visibility" };
  const [num, den] = ratio.split("/").map((n) => parseFloat(n));
  if (!den) return { score: null, label: "AI Visibility" };
  return { score: clamp((num / den) * 100), label: "AI Visibility" };
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

export function computeCompositeScore(results: MasterAuditResults): CompositeScore {
  const scores = [
    scoreTopic1(results).score,
    scoreTopic2(results).score,
    scoreTopic3(results).score,
    scoreTopic4(results).score,
    scoreTopic6(results).score,
    scoreTopic7(results).score,
  ];
  const score = average(scores);
  const rounded = score !== null ? Math.round(score) : null;
  const { grade, color } = gradeFromScore(rounded);
  return { score: rounded, grade, gradeColor: color };
}
