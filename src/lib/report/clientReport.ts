// Client-facing HTML exports (Summary report + Full report).
//
// Modelled on the WCAG scanner's "Export for the client" summary: a plain-
// English, self-contained HTML page for the site owner - where they stand,
// the main focus, what we found (grouped by topic, worst first) and what
// we recommend. The Full report adds a "Detailed findings" section with the
// supporting tables. Everything is built from the same scores the dashboard
// shows (lib/scoring.ts) - nothing here invents a number. Topics that
// weren't assessed are listed as such, never scored as a fail.
//
// Branding is a theme (colours, fonts, logo) chosen at export time. Logos
// are fetched from /logos and inlined as data URIs so the file works
// offline and can be emailed as-is; print CSS makes "Save as PDF" clean.

import type { MasterAuditResponse, MasterAuditResults, SourceItem } from "../../types/audit";
import {
  scoreTopic1,
  scoreTopic2,
  scoreTopic3,
  scoreTopic4,
  scoreTopic5,
  scoreTopic6,
  scoreTopic7,
  computeCompositeScore,
  gradeFromScore,
} from "../scoring";
import { fmtInt, fmtCurrencyGBP, hostnameOf } from "../format";

// ---------- Branding ----------

export type BrandKey = "bowlerhat" | "alltru" | "cobrand" | "unbranded";

interface Theme {
  label: string;
  logos: { url: string; alt: string }[];
  defaultPreparedBy: string;
  accent: string; // headings, links, number tiles
  accentSoft: string;
  highlight: string; // eyebrow, underline rules
  dark: string; // lede band, footer, table heads
  darkText: string; // text on the highlight colour
  ground: string;
  font: string;
  fontsHref: string;
}

const FIGTREE = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;700;800&display=swap";

export const THEMES: Record<BrandKey, Theme> = {
  bowlerhat: {
    label: "BowlerHat",
    logos: [{ url: "/logos/bowlerhat.png", alt: "BowlerHat" }],
    defaultPreparedBy: "BowlerHat",
    accent: "#007AFF",
    accentSoft: "#E5F1FF",
    highlight: "#F6931E",
    dark: "#293643",
    darkText: "#293643",
    ground: "#F0F0F0",
    font: '"Proxima Nova","Figtree","Segoe UI",Arial,sans-serif',
    fontsHref: FIGTREE,
  },
  alltru: {
    label: "AllTru",
    logos: [{ url: "/logos/alltru.png", alt: "AllTru" }],
    defaultPreparedBy: "AllTru",
    accent: "#0A8F78",
    accentSoft: "#E3FBF6",
    highlight: "#17FFD6",
    dark: "#0B0B0B",
    darkText: "#0B0B0B",
    ground: "#F2F4F3",
    font: '"Figtree","Segoe UI",Arial,sans-serif',
    fontsHref: FIGTREE,
  },
  cobrand: {
    label: "BowlerHat × AllTru",
    logos: [
      { url: "/logos/bowlerhat.png", alt: "BowlerHat" },
      { url: "/logos/alltru.png", alt: "AllTru" },
    ],
    defaultPreparedBy: "BowlerHat × AllTru",
    accent: "#007AFF",
    accentSoft: "#E5F1FF",
    highlight: "#17FFD6",
    dark: "#293643",
    darkText: "#293643",
    ground: "#F0F0F0",
    font: '"Proxima Nova","Figtree","Segoe UI",Arial,sans-serif',
    fontsHref: FIGTREE,
  },
  unbranded: {
    label: "Unbranded",
    logos: [],
    defaultPreparedBy: "",
    accent: "#2F5BEA",
    accentSoft: "#EAF0FF",
    highlight: "#2F5BEA",
    dark: "#1F2933",
    darkText: "#FFFFFF",
    ground: "#F3F4F6",
    font: '"Figtree","Segoe UI",Arial,sans-serif',
    fontsHref: FIGTREE,
  },
};

export type ReportKind = "summary" | "full";

export interface ClientReportOptions {
  kind: ReportKind;
  brand: BrandKey;
  clientName: string;
  preparedBy: string;
}

// ---------- Helpers ----------

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const plural = (n: number, one: string, many = `${one}s`) => `${fmtInt(n)} ${n === 1 ? one : many}`;

const listJoin = (items: string[]): string =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ---------- Topic assessment ----------

type Prio = "first" | "next" | "keep";

interface TopicFinding {
  n: number;
  name: string; // client-facing topic name
  score: number | null;
  prio: Prio | null;
  headline: string;
  points: string[]; // plain-English sentences
  facts: string[]; // short "label: value" facts
  action: string; // what we recommend
  sources: SourceItem[];
}

function prioFor(score: number | null): Prio | null {
  if (score === null) return null;
  if (score < 60) return "first";
  if (score < 80) return "next";
  return "keep";
}

function statusWord(score: number | null): string {
  if (score === null) return "Not assessed";
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good, room to improve";
  if (score >= 40) return "Room to grow";
  return "Biggest opportunity";
}

// Topic names mid-sentence: lower-case, but keep "AI" and "Google" as they are.
const inSentence = (name: string): string => (/^(AI|Google)\b/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const round = (n: number | null): number | null => (n === null ? null : Math.round(n));

function assessTopics(r: MasterAuditResults): TopicFinding[] {
  const out: TopicFinding[] = [];

  // Topic 1
  {
    const d = r.topic1_technical?.data;
    const score = round(scoreTopic1(r).score);
    const points: string[] = [];
    const facts: string[] = [];
    const w = d?.wcag_accessibility;
    // Client-facing: no WCAG counts or criteria lists - a long list of
    // technical failures alarms more than it informs. The detail lives in
    // the dashboard / WCAG scanner for the team; the client gets the gist.
    if (w) {
      const wScore = w.score ?? null;
      points.push(
        wScore !== null && wScore >= 80
          ? "The site is in good shape for accessibility, with a few small improvements we can make so it works well for every visitor."
          : "We've reviewed how easy the site is to use for everyone, including people using screen readers or keyboards. There are some improvements to make, and we'll take you through them."
      );
    }
    const g = d?.gdpr_compliance;
    if (g) {
      facts.push(`Privacy & cookies: ${g.is_gdpr_compliant ? "compliant" : "gaps found"}`);
      if (!g.banner?.banner_detected) points.push("We couldn't find a cookie consent banner, which UK privacy rules expect.");
      else if (!g.banner.has_reject_button) points.push("The cookie banner doesn't offer an equally easy way to reject cookies, which the ICO expects.");
      if (g.non_essential_preconsent_risk) points.push("A few tracking tools start before visitors agree to cookies. This is usually a quick settings change.");
      const missing = [
        !g.policies?.privacy_policy && "a privacy policy",
        !g.policies?.cookie_policy && "a cookie policy",
      ].filter(Boolean) as string[];
      if (missing.length) points.push(`We couldn't find ${listJoin(missing)} linked from the site.`);
    }
    const ssl = d?.technical_standards?.ssl_certificate;
    if (ssl?.is_expired) points.push("The site's security certificate has expired, so browsers will warn visitors away.");
    else if (ssl?.days_remaining != null && ssl.days_remaining <= 45)
      points.push(`The site's security certificate renews in ${ssl.days_remaining} days. Worth checking it's set to renew automatically.`);
    const sm = d?.technical_standards?.sitemap;
    if (sm?.found === false && !sm.check_failed) points.push("There's no sitemap, which helps search engines find every page.");
    out.push({
      n: 1,
      name: "Accessibility & compliance",
      score,
      prio: prioFor(score),
      headline:
        score === null ? "Not assessed this time" : score >= 80 ? "In good shape, with a few things to tidy" : "A few improvements will make the site easier for everyone to use",
      points,
      facts,
      action: "Work through the accessibility improvements we'll share with your team, and tidy up cookie consent so the site follows UK guidance.",
      sources: r.topic1_technical?.sources ?? [],
    });
  }

  // Topic 2
  {
    const d = r.topic2_performance?.data;
    const score = round(scoreTopic2(r).score);
    const points: string[] = [];
    const facts: string[] = [];
    const mob = d?.core_web_vitals?.mobile;
    const desk = d?.core_web_vitals?.desktop;
    if (mob?.performance_score != null) facts.push(`Mobile speed: ${Math.round(mob.performance_score)}/100`);
    if (desk?.performance_score != null) facts.push(`Desktop speed: ${Math.round(desk.performance_score)}/100`);
    if (mob?.lcp_ms != null) {
      const s = (mob.lcp_ms / 1000).toFixed(1);
      points.push(
        mob.lcp_ms > 4000
          ? `On a phone, the main content takes about ${s} seconds to appear. Google's target is under 2.5 seconds, and slow pages lose visitors and rankings.`
          : mob.lcp_ms > 2500
          ? `On a phone, the main content takes about ${s} seconds to appear, a little over Google's 2.5-second target.`
          : `On a phone, the main content appears in about ${s} seconds, within Google's target.`
      );
    }
    const m = d?.metadata_analysis;
    if (m && m.total_urls_analyzed > 0) {
      if (m.indexation_errors_count) {
        points.push(`${plural(m.indexation_errors_count, "page")} out of ${fmtInt(m.total_urls_analyzed)} can't be shown in Google, usually because of broken links or redirects.`);
        facts.push(`Pages Google can't show: ${fmtInt(m.indexation_errors_count)}`);
      }
      const missingDesc = m.meta_counts?.description?.missing ?? 0;
      const missingTitle = m.meta_counts?.title?.missing ?? 0;
      const dupTitle = m.meta_counts?.title?.duplicate ?? 0;
      const bits = [
        missingTitle && plural(missingTitle, "page") + " without a page title",
        dupTitle && plural(dupTitle, "page") + " sharing a title with another page",
        missingDesc && plural(missingDesc, "page") + " without a search description",
      ].filter(Boolean) as string[];
      if (bits.length) points.push(`How pages appear in search results could be better: ${listJoin(bits)}.`);
    }
    out.push({
      n: 2,
      name: "Speed & technical health",
      score,
      prio: prioFor(score),
      headline:
        score === null
          ? "Not assessed this time"
          : score >= 80
          ? (mob?.lcp_ms ?? 0) > 4000
            ? "Well set up for search engines, with room to speed up on phones"
            : "Fast and well set up for search engines"
          : "The site is slower than it should be, especially on phones",
      points,
      facts,
      action: "Speed up the mobile site (images and scripts are the usual culprits), fix pages Google can't show, and fill in missing titles and descriptions.",
      sources: r.topic2_performance?.sources ?? [],
    });
  }

  // Topic 3
  {
    const d = r.topic3_organic_visibility?.data;
    const score = round(scoreTopic3(r).score);
    const points: string[] = [];
    const facts: string[] = [];
    const kp = d?.keyword_position?.metrics;
    if (kp?.total_keywords_analyzed) {
      points.push(
        `You appear on Google's first page for ${plural(kp.top_10_count, "search term")} out of the ${fmtInt(kp.total_keywords_analyzed)} we looked at, ${fmtInt(kp.top_3_count)} of them in the top three.`
      );
      facts.push(`First-page search terms: ${fmtInt(kp.top_10_count)}`);
    }
    const clicks = d?.traffic_impressions?.metrics?.estimated_organic_clicks;
    if (clicks) facts.push(`Estimated visits from Google: ${fmtInt(clicks)}/month`);
    const bl = d?.backlinks_summary;
    if (bl) {
      facts.push(`Websites linking to you: ${fmtInt(bl.unique_referring_domains)}`);
      points.push(`${fmtInt(bl.unique_referring_domains)} other websites link to yours. Links from relevant, trusted sites are one of the strongest signals Google uses.`);
    }
    const gaps = d?.content_gaps?.total_content_gaps_found;
    if (gaps) points.push(`We found ${plural(gaps, "search term")} you nearly rank for (just off the first page) that new or improved content could win.`);
    const br = d?.branded_traffic?.traffic_breakdown;
    if (br && br.branded.traffic_percentage >= 50)
      points.push(`About ${Math.round(br.branded.traffic_percentage)}% of your Google visits come from people already searching for your name, so there's room to reach new customers.`);
    out.push({
      n: 3,
      name: "Google search visibility",
      score,
      prio: prioFor(score),
      headline:
        score === null ? "Not assessed this time" : score >= 80 ? "You're easy to find on Google for what you do" : "You're missing out on searches you could be winning",
      points,
      facts,
      action: "Build out content for the search terms you nearly rank for, and earn links from relevant sites in your industry.",
      sources: r.topic3_organic_visibility?.sources ?? [],
    });
  }

  // Topic 4
  {
    const d = r.topic4_ai_visibility?.data;
    const score = round(scoreTopic4(r).score);
    const points: string[] = [];
    const facts: string[] = [];
    const ratio = d?.summary?.engine_visibility_ratio;
    if (ratio) {
      const [num, den] = ratio.split("/").map((x) => parseInt(x, 10));
      facts.push(`AI assistants mentioning you: ${ratio}`);
      points.push(
        num === den
          ? `All ${den} AI assistants we tested (such as ChatGPT and Gemini) mention or cite your business.`
          : `${num} of the ${den} AI assistants we tested mention or cite your business.`
      );
    }
    if (d?.summary?.cited_search_terms_count != null) {
      facts.push(`Questions where you're cited: ${fmtInt(d.summary.cited_search_terms_count)}`);
      points.push(`You're cited in answers to ${plural(d.summary.cited_search_terms_count, "question")} people ask these assistants.`);
    }
    const rival = d?.top_competitors?.top_competitors?.find((c) => hostnameOf(c.domain) !== hostnameOf(r.topic1_technical?.data?.target_url));
    if (rival) points.push(`${rival.domain} is the competitor cited most often alongside you.`);
    out.push({
      n: 4,
      name: "AI search visibility",
      score,
      prio: prioFor(score),
      headline:
        score === null ? "Not assessed this time" : score >= 80 ? "AI assistants already recommend you" : "AI assistants don't mention you as often as they could",
      points,
      facts,
      action: "Make sure your key pages answer customers' questions clearly, and that trusted directories and review sites describe you consistently.",
      sources: r.topic4_ai_visibility?.sources ?? [],
    });
  }

  // Topic 5
  {
    const d = r.topic5_paid_visibility?.data;
    const score = round(scoreTopic5(r).score);
    const points: string[] = [];
    const facts: string[] = [];
    const kw = d?.keywords;
    const comps = d?.competitor_share?.competitor_share_breakdown ?? [];
    if (kw) {
      facts.push(`Paid search terms: ${fmtInt(kw.total_keywords)}`);
      facts.push(`Estimated ad spend: ${fmtCurrencyGBP(kw.estimated_monthly_spend)}/month`);
      points.push(
        kw.total_keywords > 0
          ? `We found ads running on ${plural(kw.total_keywords, "search term")}, with an estimated spend of ${fmtCurrencyGBP(kw.estimated_monthly_spend)} a month.`
          : "We didn't find any Google Ads activity for your site."
      );
    }
    if (comps.length) {
      const top = [...comps].sort((a, b) => (b.monthly_ad_budget ?? 0) - (a.monthly_ad_budget ?? 0))[0];
      points.push(
        `${plural(comps.length, "competitor")} ${comps.length === 1 ? "is" : "are"} advertising on similar searches. The biggest spender, ${top.domain}, spends an estimated ${fmtCurrencyGBP(top.monthly_ad_budget)} a month.`
      );
    }
    const estimate = (r.topic5_paid_visibility?.sources ?? []).some((s) => s.kind === "estimate");
    if (estimate) points.push("These figures are estimates from third-party data and usually understate real campaigns.");
    out.push({
      n: 5,
      name: "Paid search",
      score,
      prio: prioFor(score),
      headline:
        score === null
          ? kw && kw.total_keywords === 0
            ? "No paid search activity found"
            : "Not assessed this time"
          : kw && kw.total_keywords === 0
          ? comps.length && Math.max(...comps.map((c) => c.monthly_ad_budget ?? 0)) < 500
            ? "No paid search yet, and competitors are barely advertising: an open opportunity"
            : "You're not running paid search, but competitors are"
          : score >= 80
          ? "You're competing well in paid search"
          : "Bigger competitors are out-spending you on ads",
      points,
      facts,
      action: "If paid search fits your goals, a focused Google Ads campaign on your most valuable services can win customers while organic rankings build.",
      sources: r.topic5_paid_visibility?.sources ?? [],
    });
  }

  // Topic 6
  {
    const d = r.topic6_local_visibility?.data;
    const score = round(scoreTopic6(r).score);
    const points: string[] = [];
    const facts: string[] = [];
    const mp = d?.map_pack;
    if (mp && mp.total_keywords_tracked) {
      facts.push(`In Google's map results: ${mp.keywords_in_map_pack} of ${mp.total_keywords_tracked} searches`);
      points.push(
        `You appear in Google's map results (the top three local listings) for ${mp.keywords_in_map_pack} of the ${mp.total_keywords_tracked} local searches we checked.`
      );
    }
    const rv = d?.reviews?.gbp_metrics;
    if (rv) {
      facts.push(`Google reviews: ${fmtInt(rv.total_reviews)} (${rv.average_rating.toFixed(1)}★)`);
      points.push(
        rv.average_rating >= 4.5
          ? `Your ${fmtInt(rv.total_reviews)} Google reviews average ${rv.average_rating.toFixed(1)} stars, which is excellent and builds trust.`
          : `Your ${fmtInt(rv.total_reviews)} Google reviews average ${rv.average_rating.toFixed(1)} stars. Encouraging happy customers to leave reviews will help.`
      );
    }
    const c = d?.citations;
    if (c) {
      facts.push(`Directory listings: ${fmtInt(c.active_citations)}`);
      if (c.nap_consistency_score != null) {
        facts.push(`Listings with correct details: ${Math.round(c.nap_consistency_score)}%`);
        if (c.nap_consistency_score < 90)
          points.push(`Some online directory listings show an out-of-date name, address or phone number. Inconsistent details make Google less confident about where you are.`);
      }
    }
    out.push({
      n: 6,
      name: "Local search",
      score,
      prio: prioFor(score),
      headline:
        score === null ? "Not assessed this time" : score >= 80 ? "Strong local presence" : "Local customers may not find you easily",
      points,
      facts,
      action: "Correct inconsistent directory listings, keep your Google Business Profile active, and keep reviews coming in.",
      sources: r.topic6_local_visibility?.sources ?? [],
    });
  }

  // Topic 7
  {
    const d = r.topic7_content_quality?.data;
    const score = round(scoreTopic7(r).score);
    const points: string[] = [];
    const facts: string[] = [];
    const t = d?.thin_content_analysis;
    if (t && t.thin_content_page_count != null) {
      facts.push(`Pages with too little content: ${fmtInt(t.thin_content_page_count)} of ${fmtInt(t.total_pages_analyzed)}`);
      points.push(
        t.thin_content_page_count > 0
          ? `${plural(t.thin_content_page_count, "page")} out of ${fmtInt(t.total_pages_analyzed)} have very little text, which gives Google little reason to rank them.`
          : `None of the ${fmtInt(t.total_pages_analyzed)} pages we checked are short on content.`
      );
    }
    const f = d?.form_detection;
    if (f && f.pages_checked_count > 0) {
      facts.push(`Enquiry forms found: ${fmtInt(f.unique_forms_count)}`);
      points.push(
        f.unique_forms_count > 0
          ? `We found ${plural(f.unique_forms_count, "enquiry form")} across the key pages we checked.`
          : "We didn't find an enquiry form on the key pages we checked, so visitors may not have an easy way to get in touch."
      );
    }
    out.push({
      n: 7,
      name: "Content quality",
      score,
      prio: prioFor(score),
      headline: score === null ? "Not assessed this time" : score >= 80 ? "Pages are well written and substantial" : "Some pages need more substance",
      points,
      facts,
      action: "Expand or merge the thin pages, and make sure every key page has a clear way to get in touch.",
      sources: r.topic7_content_quality?.sources ?? [],
    });
  }

  return out;
}

// ---------- Detailed tables (Full report) ----------

function table(head: string[], rows: (string | number)[][], numericCols: number[] = []): string {
  if (!rows.length) return "";
  return `<div class="appx"><table><thead><tr>${head.map((h, i) => `<th${numericCols.includes(i) ? ' class="n"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((c, i) => `<td${numericCols.includes(i) ? ' class="n"' : ""}>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function detailTables(r: MasterAuditResults, n: number): string {
  const parts: string[] = [];
  const h = (t: string) => `<h4>${esc(t)}</h4>`;
  // n === 1: deliberately no accessibility tables in client reports.
  if (n === 2) {
    const v = r.topic2_performance?.data?.core_web_vitals;
    const row = (label: string, m?: number | null, d?: number | null, f: (x: number) => string = (x) => String(Math.round(x))) => [
      label,
      m != null ? f(m) : "–",
      d != null ? f(d) : "–",
    ];
    if (v)
      parts.push(
        h("Speed test (Google Lighthouse)"),
        table(
          ["Measure", "Mobile", "Desktop"],
          [
            row("Speed score (out of 100)", v.mobile?.performance_score, v.desktop?.performance_score),
            row("Main content visible", v.mobile?.lcp_ms, v.desktop?.lcp_ms, (x) => `${(x / 1000).toFixed(1)}s`),
            row("Layout shift (lower is better)", v.mobile?.cls, v.desktop?.cls, (x) => x.toFixed(3)),
            row("Time blocked by scripts", v.mobile?.total_blocking_time_ms, v.desktop?.total_blocking_time_ms, (x) => `${Math.round(x)}ms`),
          ],
          [1, 2]
        )
      );
    const m = r.topic2_performance?.data?.metadata_analysis;
    if (m?.meta_counts)
      parts.push(
        h("Page titles and descriptions"),
        table(
          ["", "Missing", "Duplicated", "More than one"],
          [
            ["Page titles", m.meta_counts.title.missing ?? "–", m.meta_counts.title.duplicate ?? "–", m.meta_counts.title.multiple ?? "–"],
            ["Search descriptions", m.meta_counts.description.missing ?? "–", m.meta_counts.description.duplicate ?? "–", m.meta_counts.description.multiple ?? "–"],
          ],
          [1, 2, 3]
        )
      );
  }
  if (n === 3) {
    const d = r.topic3_organic_visibility?.data;
    if (d?.top_keywords?.top_keywords?.length)
      parts.push(
        h("Top search terms bringing visitors"),
        table(
          ["Search term", "Searches/month", "Est. visits", "Position"],
          d.top_keywords.top_keywords.slice(0, 15).map((k) => [k.keyword, fmtInt(k.impressions_volume), fmtInt(k.estimated_clicks), k.average_position]),
          [1, 2, 3]
        )
      );
    if (d?.content_gaps?.content_gaps?.length)
      parts.push(
        h("Search terms you nearly rank for"),
        table(
          ["Search term", "Searches/month", "Current position", "Priority"],
          d.content_gaps.content_gaps.slice(0, 15).map((k) => [k.keyword, fmtInt(k.search_volume), k.current_position, k.opportunity_priority]),
          [1, 2]
        )
      );
    if (d?.domain_rating?.top_competitors?.length)
      parts.push(
        h("Competitors in Google search (authority out of 100)"),
        table(["Competitor", "Authority"], d.domain_rating.top_competitors.slice(0, 10).map((c) => [c.domain, c.dr]), [1])
      );
  }
  if (n === 4) {
    const d = r.topic4_ai_visibility?.data;
    if (d?.engine_visibility?.engine_visibility_breakdown?.length)
      parts.push(
        h("By AI assistant"),
        table(
          ["Assistant", "Questions tracked", "Sources citing you"],
          d.engine_visibility.engine_visibility_breakdown.map((e) => [ENGINE_NAMES[e.engine.toLowerCase()] ?? e.engine.charAt(0).toUpperCase() + e.engine.slice(1), e.keyword_count, e.source_count]),
          [1, 2]
        )
      );
    if (d?.top_competitors?.top_competitors?.length)
      parts.push(h("Most-cited websites"), table(["Website", "Citations"], d.top_competitors.top_competitors.slice(0, 10).map((c) => [c.domain, fmtInt(c.citations)]), [1]));
  }
  if (n === 5) {
    const d = r.topic5_paid_visibility?.data;
    if (d?.keywords?.top_keywords?.length)
      parts.push(
        h("Paid search terms"),
        table(["Search term", "Searches/month", "Cost per click"], d.keywords.top_keywords.slice(0, 15).map((k) => [k.keyword, fmtInt(k.search_volume), fmtCurrencyGBP(k.cpc)]), [1, 2])
      );
    const comps = d?.competitor_share?.competitor_share_breakdown ?? [];
    if (comps.length)
      parts.push(
        h("Competitors advertising"),
        table(
          ["Competitor", "Paid search terms", "Est. spend/month"],
          comps.slice(0, 10).map((c) => [c.domain, fmtInt(c.monthly_paid_keywords), fmtCurrencyGBP(c.monthly_ad_budget)]),
          [1, 2]
        )
      );
  }
  if (n === 6) {
    const mp = r.topic6_local_visibility?.data?.map_pack;
    if (mp?.keyword_breakdown?.length)
      parts.push(
        h("Local search positions"),
        table(
          ["Search", "Result"],
          mp.keyword_breakdown.map((k) => [
            k.keyword,
            k.in_map_pack ? `Map results, #${k.local_pack_position}` : k.found ? `Local results, #${k.local_pack_position}` : "Not found",
          ])
        )
      );
    const c = r.topic6_local_visibility?.data?.citations;
    if (c)
      parts.push(
        h("Directory listings"),
        table(
          ["", "Count"],
          [
            ["Live listings", fmtInt(c.active_citations)],
            ["Duplicate listings", fmtInt(c.duplicate_citations)],
            ["High-authority listings", fmtInt(c.high_authority_citations)],
            ["Directories you could be listed on", fmtInt(c.potential_citation_opportunities)],
          ],
          [1]
        )
      );
  }
  if (n === 7) {
    const t = r.topic7_content_quality?.data?.thin_content_analysis;
    const thin = (t?.page_details ?? []).filter((p) => p.is_thin);
    if (thin.length) parts.push(h("Pages with too little content"), table(["Page", "Words"], thin.slice(0, 20).map((p) => [p.url, fmtInt(p.word_count)]), [1]));
  }
  return parts.join("");
}

// ---------- HTML ----------

const ENGINE_NAMES: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude", sonar: "Perplexity", perplexity: "Perplexity", copilot: "Copilot" };

const NUMBER_WORDS: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six" };

// Client-facing tool names: no "CSV", "API" or engine names.
function friendlySource(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("ahrefs")) return "Ahrefs";
  if (n.includes("waikay")) return "Waikay";
  if (n.includes("spyfu")) return "SpyFu";
  if (n.includes("screaming frog")) return "Screaming Frog";
  if (n.includes("pagespeed") || n.includes("lighthouse")) return "Google PageSpeed Insights";
  if (n.includes("brightlocal")) return "BrightLocal";
  if (n.includes("serpapi") || n.includes("google maps")) return "Google Maps";
  if (n.includes("wcag") || n.includes("accessib")) return "accessibility testing";
  if (n.includes("cookie") || n.includes("gdpr")) return "privacy and cookie checks";
  return "live checks of your website";
}
function friendlySources(sources: { name: string }[]): string[] {
  return Array.from(new Set(sources.map((s) => friendlySource(s.name))));
}

const PRIO_LABEL: Record<Prio, string> = { first: "Top priority", next: "Worth improving", keep: "Keep it up" };

export async function buildClientReport(audit: MasterAuditResponse, opts: ClientReportOptions): Promise<string> {
  const theme = THEMES[opts.brand];
  const r = audit.master_audit_results;
  const site = hostnameOf(audit.target_url) || audit.target_url;
  const client = opts.clientName.trim() || site;
  const preparedBy = opts.preparedBy.trim();
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const topics = assessTopics(r);
  const scored = topics.filter((t) => t.score !== null);
  const notAssessed = topics.filter((t) => t.score === null);
  const composite = computeCompositeScore(r).score;
  const grade = gradeFromScore(composite).grade;
  const counts = {
    keep: scored.filter((t) => t.prio === "keep").length,
    next: scored.filter((t) => t.prio === "next").length,
    first: scored.filter((t) => t.prio === "first").length,
  };
  // ---- Main focus ----
  // BowlerHat's view: SEO, AI and PPC work hand in hand, so they're treated
  // as one focus ("working together"). The exception is technical: if the
  // site itself (Topics 1-2) is what's letting the report down, fixing that
  // comes first, because it holds back everything built on top of it.
  const avgOf = (ns: number[]): number | null => {
    const s = topics.filter((t) => ns.includes(t.n) && t.score !== null).map((t) => t.score as number);
    return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
  };
  const groups = [
    { key: "tech", label: "Technical", desc: "accessibility, speed and technical set-up", score: avgOf([1, 2]) },
    { key: "seo", label: "SEO", desc: "Google and local search, and content", score: avgOf([3, 6, 7]) },
    { key: "ai", label: "AI", desc: "AI search", score: avgOf([4]) },
    { key: "ppc", label: "PPC", desc: "paid search", score: avgOf([5]) },
  ];
  const tech = groups[0];
  const visibility = groups.slice(1).filter((g) => g.score !== null);
  const visibilityAvg = visibility.length ? Math.round(visibility.reduce((a, g) => a + (g.score as number), 0) / visibility.length) : null;
  const sortedScored = [...scored].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const lowestIsTechnical = !!sortedScored.length && sortedScored[0].n <= 2 && sortedScored[0].prio !== "keep";
  const focusTechnical =
    tech.score !== null && (lowestIsTechnical || (visibilityAvg !== null && tech.score < visibilityAvg && tech.score < 80));
  const weakestVisibility = [...visibility].sort((a, b) => (a.score as number) - (b.score as number))[0];
  // SEO, AI and PPC are unified, but one of them can still be the primary
  // cause: without it, the other two suffer. Name it when it isn't strong.
  const primary = !focusTechnical && weakestVisibility && (weakestVisibility.score as number) < 80 ? weakestVisibility : null;
  const PRIMARY_TITLE: Record<string, string> = { seo: "SEO", ai: "AI search", ppc: "Paid search (PPC)" };
  const PRIMARY_NAME: Record<string, string> = { seo: "SEO", ai: "AI search visibility", ppc: "Paid search" };
  const others = (k: string) => listJoin(groups.slice(1).filter((g) => g.key !== k).map((g) => (g.key === "ai" ? "AI search" : g.label)));
  const focusTitle = focusTechnical ? "Technical foundations" : primary ? PRIMARY_TITLE[primary.key] : "SEO, AI & PPC together";
  const focusText = focusTechnical
    ? "Your website's accessibility, speed and technical set-up are what's holding the rest back. Fixing these first means every pound spent on SEO, AI and paid search works harder."
    : primary
    ? `${PRIMARY_NAME[primary.key]} is the main thing holding you back. SEO, AI search and paid search work hand in hand: without it, ${others(primary.key)} can't reach their potential either.`
    : "SEO, AI search and paid search are all in good shape. The next gains come from keeping them working together, so each one strengthens the others.";
  const focusPill = (g: (typeof groups)[number], cls: string) =>
    `<span class="${cls}"><b>${g.label}</b><small>${g.score ?? "–"}</small></span>`;
  const focusDial = `<div class="focus" aria-hidden="true">${focusPill(tech, focusTechnical ? "on" : "")}<div class="together${focusTechnical ? "" : " on"}">${groups
    .slice(1)
    .map((g) => focusPill(g, focusTechnical ? "" : primary ? (g.key === primary.key ? "on" : "soft") : "on"))
    .join("")}<em>Working together</em></div></div>`;

  const worstFirst = [...scored].sort((a, b) => {
    // With a technical focus, technical topics lead the findings and the plan.
    if (focusTechnical && (a.n <= 2) !== (b.n <= 2) && (a.prio !== "keep" || b.prio !== "keep")) {
      const aT = a.n <= 2 && a.prio !== "keep";
      const bT = b.n <= 2 && b.prio !== "keep";
      if (aT !== bT) return aT ? -1 : 1;
    }
    return (a.score ?? 0) - (b.score ?? 0);
  });
  const priorities = worstFirst.filter((t) => t.prio !== "keep").slice(0, 3);
  const strengths = [...scored].filter((t) => t.prio === "keep").sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const logos = (await Promise.all(theme.logos.map(async (l) => ({ ...l, src: await toDataUri(l.url) })))).filter((l) => l.src);
  const logoHtml = logos.length
    ? logos.map((l) => `<img class="bh-logo" src="${l.src}" alt="${esc(l.alt)}">`).join('<span class="logo-x">×</span>')
    : `<span class="bh-word">${esc(preparedBy || "Website audit")}</span>`;

  const GENERIC = new Set(["live checks of your website", "accessibility testing", "privacy and cookie checks"]);
  const sourceNames = friendlySources(topics.flatMap((t) => t.sources)).filter((s) => !GENERIC.has(s));

  const themeHtml = (t: TopicFinding) => `<li class="theme"><span class="prio p-${t.prio}">${PRIO_LABEL[t.prio as Prio]}</span><div class="body">
        <p class="tname">${esc(t.name)} · <b>${t.score}</b>/100</p>
        <h3>${esc(t.headline)}</h3>
        ${t.points.map((p) => `<p>${esc(p)}</p>`).join("")}
        ${t.facts.length ? `<p class="facts">${t.facts.map((f) => `<span>${esc(f)}</span>`).join("")}</p>` : ""}</div></li>`;

  const tile = (t: TopicFinding) =>
    `<div class="tile t-${t.prio ?? "na"}"><b>${t.score ?? "–"}</b><span class="tn">${esc(t.name)}</span><span class="ts">${esc(statusWord(t.score))}</span></div>`;

  const planSteps: { h: string; p: string }[] = priorities.map((t) => ({ h: t.name, p: t.action }));
  if (strengths.length)
    planSteps.push({
      h: "Protect what's working",
      p: `${cap(listJoin(strengths.map((s) => inSentence(s.name))))} ${strengths.length === 1 ? "is" : "are"} in good shape. Keep ${strengths.length === 1 ? "it" : "them"} that way as the site changes.`,
    });
  planSteps.push({ h: "Re-audit in three months", p: "We'll run the same checks again so you can see the progress." });

  const fullDetail =
    opts.kind === "full"
      ? `<section aria-labelledby="detail-h"><h2 id="detail-h">Detailed findings</h2>
    <p>The figures behind each topic, for you or your web team.</p>
    ${topics
      .map((t) => {
        const tables = detailTables(r, t.n);
        if (t.score === null && !tables) return "";
        return `<div class="detail"><h3>${t.n}. ${esc(t.name)}${t.score !== null ? ` <span class="ds">${t.score}/100</span>` : ""}</h3>${tables}${
          t.sources.length ? `<p class="small">Data: ${esc(listJoin(friendlySources(t.sources)))}</p>` : ""
        }</div>`;
      })
      .join("")}</section>`
      : "";

  const title = opts.kind === "full" ? "Website & marketing audit" : "Website & marketing audit summary";

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}: ${esc(site)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${theme.fontsHref}">
<style>
:root{--accent:${theme.accent};--accent-soft:${theme.accentSoft};--hl:${theme.highlight};--dark:${theme.dark};--on-hl:${theme.darkText};--ground:${theme.ground};--paper:#fff;--ink:#333;--ink-2:#54595F;--ink-3:#7F7F7F;--rule:#E1E4E8;
  --good:#2BA84A;--good-soft:#E6F6EA;--bad:#D31459;--bad-soft:#FCE8EF;--mid:#F6931E;--mid-soft:#FEF2E3;--font:${theme.font};color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--ground);color:var(--ink);font:500 17px/1.6 var(--font);letter-spacing:.2px;padding:24px 16px 56px}
h1,h2,h3,h4{font-family:var(--font);font-weight:700;margin:0;text-wrap:balance;color:var(--ink)}p{margin:0}b{font-weight:700}
.bh-head{max-width:860px;margin:0 auto;background:#fff;box-shadow:0 2px 10px rgba(41,54,67,.08)}
.bh-strip{background:var(--dark);color:#fff;display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 20px;padding:8px clamp(18px,4vw,40px);font-size:13px;letter-spacing:.3px}
.bh-strip b{color:var(--hl)}
.bh-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px clamp(18px,4vw,40px);border-bottom:2px solid var(--accent)}
.logos{display:flex;align-items:center;gap:12px}.bh-logo{display:block;height:36px;width:auto}.logo-x{color:var(--ink-3);font-size:18px}
.bh-word{font-weight:800;font-size:24px;color:var(--dark)}.bh-tag{font-size:15px;color:var(--dark)}
.doc{max-width:860px;margin:0 auto;background:var(--paper);box-shadow:0 2px 10px rgba(41,54,67,.08);padding:0 clamp(18px,4vw,40px) clamp(22px,5vw,48px);display:grid;gap:40px}
.lede{display:grid;gap:12px;margin:0 calc(-1 * clamp(18px,4vw,40px));padding:clamp(28px,5vw,48px) clamp(18px,4vw,40px);background:var(--dark);border-bottom:4px solid var(--accent);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.eyebrow{font-size:14px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--hl)}
.lede h1{font-size:clamp(32px,5.4vw,46px);line-height:1.08;color:#fff}.lede p{max-width:62ch;color:#fff;font-size:18px}
.verdicts{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
.v{background:#FBFBFB;border-top:4px solid var(--accent);border-radius:5px;padding:20px;display:grid;gap:14px;align-content:start;box-shadow:0 2px 10px rgba(41,54,67,.08)}
.v .q{font-size:14px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.08em}.v .a{font-size:32px;line-height:1.1;font-weight:700;color:var(--dark)}.v .a small{font-size:18px;color:var(--ink-3);font-weight:700;margin-left:6px}.v p{font-size:16px;color:var(--ink-2)}
.a.low{color:var(--good)}.a.moderate{color:var(--mid)}.a.high{color:var(--bad)}
.bar{display:flex;height:14px;border-radius:3px;overflow:hidden;gap:2px}.bar span{display:block}
.keys{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px;color:var(--ink-2)}.keys i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}.keys b{color:var(--ink)}
.dial{display:flex;gap:6px}.dial span{flex:1;text-align:center;font-size:13.5px;font-weight:700;padding:7px 0;border-radius:3px;background:var(--ground);color:var(--ink-3);border:2px solid transparent}
.focus{display:flex;gap:6px;align-items:stretch}.focus span{flex:1;display:grid;justify-items:center;gap:0;padding:7px 0;border-radius:3px;background:var(--ground);color:var(--ink-3);font-size:13.5px;line-height:1.3}.focus span small{font-size:12px;font-weight:700;opacity:.8}.focus span.on{background:var(--accent);color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.focus span.soft{background:var(--accent-soft);color:var(--accent);-webkit-print-color-adjust:exact;print-color-adjust:exact}\n.together{flex:3;display:flex;gap:6px;position:relative;padding-bottom:18px}.together em{position:absolute;left:0;right:0;bottom:0;text-align:center;font-style:normal;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);border-top:2px solid var(--rule);padding-top:2px}.together.on em{color:var(--accent);border-color:var(--accent)}.focus>span{margin-bottom:18px}.focus-a{color:var(--accent)!important}
section{display:grid;gap:16px}section>h2{font-size:28px;line-height:1.15}section>h2::after{content:"";display:block;width:56px;height:4px;background:var(--hl);margin-top:10px;border-radius:2px}
section>p{max-width:64ch;color:var(--ink-2)}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.tile{border-radius:5px;padding:14px;display:grid;gap:2px;border-left:4px solid var(--rule);background:#FBFBFB;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.tile b{font-size:34px;line-height:1;font-variant-numeric:tabular-nums}.tile .tn{font-size:14.5px;font-weight:700;color:var(--ink)}.tile .ts{font-size:13px;color:var(--ink-2)}
.t-keep{border-color:var(--good);background:var(--good-soft)}.t-keep b{color:var(--good)}
.t-next{border-color:var(--mid);background:var(--mid-soft)}.t-next b{color:#B86A0E}
.t-first{border-color:var(--bad);background:var(--bad-soft)}.t-first b{color:var(--bad)}
.t-na{border:1px dashed var(--rule);border-left:4px dashed var(--rule)}.t-na b{color:var(--ink-3)}
.themes{list-style:none;margin:0;padding:0;display:grid}.theme{display:grid;grid-template-columns:112px minmax(0,1fr);gap:6px 18px;padding:18px 0;border-top:1px solid var(--rule)}
@media (max-width:560px){.theme{grid-template-columns:minmax(0,1fr)}}
.prio{font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;align-self:start;justify-self:start;padding:4px 9px;border-radius:3px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.p-first{background:var(--bad);color:#fff}.p-next{background:var(--mid);color:#293643}.p-keep{background:var(--good);color:#fff}
.tname{font-size:13px!important;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3)!important}.tname b{color:var(--ink)}
.theme h3{font-size:20px;line-height:1.25;color:var(--accent)}.theme p{color:var(--ink-2);font-size:16px}.theme .body{display:grid;gap:6px;min-width:0}
.facts{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:14px!important;color:var(--ink-3)!important;margin-top:4px!important}
.plan{list-style:none;counter-reset:s;margin:0;padding:0;display:grid;gap:14px}.plan li{counter-increment:s;display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px}
.plan li::before{content:counter(s);font-weight:800;font-size:20px;width:40px;height:40px;border-radius:5px;display:grid;place-items:center;background:var(--accent);color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.plan h3{font-size:18px}.plan p{color:var(--ink-2);font-size:16px}
.small{font-size:14px!important;color:var(--ink-3)!important;max-width:70ch}
.detail{display:grid;gap:10px;padding-top:16px;border-top:1px solid var(--rule)}.detail h3{font-size:20px;color:var(--accent)}.ds{font-size:15px;color:var(--ink-3);font-weight:700;margin-left:6px}
.detail h4{font-size:15px;color:var(--ink);margin-top:6px}
.appx{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14.5px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--rule);vertical-align:top;word-break:break-word}
thead th{background:var(--dark);color:#fff;font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact}tbody tr:nth-child(even){background:#FBFBFB}.n{text-align:right;font-variant-numeric:tabular-nums}
.foot{margin:0 calc(-1 * clamp(18px,4vw,40px)) calc(-1 * clamp(22px,5vw,48px));padding:16px clamp(18px,4vw,40px);background:var(--dark);color:#C8D1DA;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 20px;font-size:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.foot b{color:#fff}
@media print{body{background:#fff;padding:0}.doc,.bh-head{box-shadow:none;max-width:none}section>h2,.theme,.v,.tile,.detail h4,tr{break-inside:avoid}.bh-strip{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:14mm}}
</style>
</head>
<body>
<header class="bh-head">
  <div class="bh-strip"><span>${esc(opts.kind === "full" ? "Website & marketing audit" : "Website & marketing summary")} for <b>${esc(client)}</b></span><span>${esc(today)}</span></div>
  <div class="bh-bar"><div class="logos">${logoHtml}</div><span class="bh-tag">SEO &amp; marketing audit</span></div>
</header>
<main class="doc" aria-labelledby="doc-h">
  <div class="lede">
    <p class="eyebrow">${esc(site)}</p>
    <h1 id="doc-h">How well is your website working for you?</h1>
    <p>We audited your website across ${scored.length === 7 ? "seven" : `${NUMBER_WORDS[scored.length] ?? scored.length} of seven`} areas that decide whether customers find you and get in touch: accessibility, speed, Google search, AI search, paid search, local search and content. This ${opts.kind === "full" ? "report" : "summary"} covers where you stand, where to focus, and what we recommend doing next.</p>
  </div>
  <div class="verdicts">
    <div class="v"><p class="q">Where you stand</p><p class="a">${composite ?? "–"}<small>/100 · ${esc(grade)}</small></p>
      <div class="bar" role="img" aria-label="Of ${scored.length} areas assessed: ${counts.keep} strong, ${counts.next} room to improve, ${counts.first} top priority">
        ${counts.keep ? `<span style="flex:${counts.keep};background:var(--good)"></span>` : ""}${counts.next ? `<span style="flex:${counts.next};background:var(--mid)"></span>` : ""}${counts.first ? `<span style="flex:${counts.first};background:var(--bad)"></span>` : ""}</div>
      <div class="keys"><span><i style="background:var(--good)"></i><b>${counts.keep}</b> strong</span><span><i style="background:var(--mid)"></i><b>${counts.next}</b> room to improve</span><span><i style="background:var(--bad)"></i><b>${counts.first}</b> top priority</span></div>
      <p>${
        strengths.length
          ? `Your strongest area${strengths.length > 1 ? "s are" : " is"} ${listJoin(strengths.slice(0, 2).map((s) => inSentence(s.name)))}.`
          : "None of the areas we assessed is yet where it could be."
      }${worstFirst.length && worstFirst[0].prio !== "keep" ? ` The biggest opportunity is ${inSentence(worstFirst[0].name)}.` : ""}</p></div>
    <div class="v"><p class="q">What's the main focus</p><p class="a focus-a">${esc(focusTitle)}</p>
      ${focusDial}
      <p>${esc(focusText)}</p></div>
  </div>
  <section aria-labelledby="glance-h"><h2 id="glance-h">At a glance</h2>
    <p>Each area is scored out of 100 from what we measured.${notAssessed.length ? ` ${cap(listJoin(notAssessed.map((t) => inSentence(t.name))))} ${notAssessed.length === 1 ? "wasn't" : "weren't"} assessed this time, so ${notAssessed.length === 1 ? "it doesn't" : "they don't"} count towards the overall score.` : ""}</p>
    <div class="tiles">${topics.map(tile).join("")}</div>
  </section>
  <section aria-labelledby="found-h"><h2 id="found-h">What we found</h2>
    <p>Grouped by area, most important first.</p>
    <ul class="themes">${worstFirst.map(themeHtml).join("")}</ul>
  </section>
  <section aria-labelledby="plan-h"><h2 id="plan-h">What we recommend</h2>
    <ol class="plan">${planSteps.map((s) => `<li><div><h3>${esc(s.h)}</h3><p>${esc(s.p)}</p></div></li>`).join("")}</ol>
  </section>
  ${fullDetail}
  <section aria-labelledby="how-h"><h2 id="how-h">How we audited</h2>
    <p>We combined live checks of your website with data from industry tools${sourceNames.length ? ` (${esc(listJoin(sourceNames))})` : ""}. Each area's score comes only from data we actually gathered: an area we couldn't assess is left out rather than counted as a fail.</p>
    <p class="small">Figures from third-party tools are estimates and can differ from your own analytics. Scores are a guide to priorities, not a guarantee of rankings.</p>
  </section>
  <div class="foot"><span>Prepared for <b>${esc(client)}</b>${preparedBy ? ` by <b>${esc(preparedBy)}</b>` : ""}</span><span>Audit of ${esc(today)} · ${esc(site)}</span></div>
</main>
</body>
</html>`;
}

export function reportFilename(audit: MasterAuditResponse, kind: ReportKind): string {
  const site = (hostnameOf(audit.target_url) || "site").replace(/^www\./, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${site}-${date}-${kind === "full" ? "audit-report" : "audit-summary"}.html`;
}
