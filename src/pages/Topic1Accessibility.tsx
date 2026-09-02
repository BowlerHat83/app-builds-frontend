import type { Envelope, Topic1Data } from "../types/audit";
import Card from "../components/ui/Card";
import GaugeRing from "../components/ui/GaugeRing";
import Badge from "../components/ui/Badge";
import Tip from "../components/ui/Tip";
import DataTable, { Column } from "../components/ui/DataTable";
import DistributionBar from "../components/charts/DistributionBar";
import { fmtInt, truncate, hostnameOf } from "../lib/format";
import type { WcagIssue, CookieDetected, HtmlValidationErrorRow } from "../types/audit";

export default function Topic1Accessibility({ envelope }: { envelope: Envelope<Topic1Data> }) {
  const d = envelope.data;
  const sitemap = d.technical_standards?.sitemap;
  const ssl = d.technical_standards?.ssl_certificate;
  const html = d.technical_standards?.html_syntax;
  const wcag = d.wcag_accessibility;
  const gdpr = d.gdpr_compliance;

  const issueColumns: Column<WcagIssue>[] = [
    { key: "code", header: "Code", render: (r) => <span className="cell-mono">{r.code}</span> },
    { key: "description", header: "Description", render: (r) => r.description },
    {
      key: "impact",
      header: "Impact",
      render: (r) => {
        const tone = r.impact === "Critical" ? "bad" : r.impact === "Serious" ? "warn" : "neutral";
        return <Badge tone={tone as "bad" | "warn" | "neutral"}>{r.impact}</Badge>;
      },
    },
    { key: "occurrences", header: "Count", align: "right", render: (r) => fmtInt(r.occurrences ?? 1) },
    { key: "element", header: "Element", render: (r) => <span className="cell-mono cell-muted">{truncate(r.element, 70)}</span> },
  ];

  const htmlErrorColumns: Column<HtmlValidationErrorRow>[] = [
    { key: "line", header: "Line", align: "right", render: (r) => (r.line != null ? fmtInt(r.line) : "–") },
    { key: "column", header: "Col", align: "right", render: (r) => (r.column != null ? fmtInt(r.column) : "–") },
    { key: "error_type", header: "Type", render: (r) => <span className="cell-mono cell-muted">{r.error_type}</span> },
    { key: "message", header: "Message", render: (r) => truncate(r.message, 110) },
  ];

  const targetHost = hostnameOf(d.target_url);
  const isFirstParty = (cookieDomain: string) => {
    const h = (cookieDomain || "").toLowerCase().replace(/^\./, "").replace(/^www\./, "");
    return targetHost !== "–" && (h === targetHost || h.endsWith(`.${targetHost}`) || targetHost.endsWith(`.${h}`));
  };

  const cookieColumns: Column<CookieDetected>[] = [
    { key: "name", header: "Cookie", render: (r) => <span className="cell-mono">{r.name}</span> },
    { key: "domain", header: "Domain", render: (r) => r.domain },
    {
      key: "party",
      header: "Party",
      render: (r) =>
        isFirstParty(r.domain) ? (
          <Badge tone="neutral">First-party</Badge>
        ) : (
          <Badge tone="warn">Third-party</Badge>
        ),
    },
    { key: "path", header: "Path", render: (r) => <span className="cell-muted">{r.path}</span> },
    { key: "secure", header: "Secure", render: (r) => (r.secure === "True" ? <Badge tone="good">Yes</Badge> : <Badge tone="neutral">No</Badge>) },
  ];

  // Raw issue-type counts per severity, straight from by_impact - matches
  // the stat boxes below exactly. This used to render severity-WEIGHTED
  // points lost (mirroring the backend's own score formula) instead of
  // real counts, which read as a mismatch against the boxes even though
  // both numbers were individually correct - just different units. Real
  // counts only, now, for one consistent picture.
  const wcagCounts = wcag
    ? {
        critical: wcag.by_impact.critical,
        serious: wcag.by_impact.serious,
        moderate: wcag.by_impact.moderate,
        minor: wcag.by_impact.minor,
      }
    : null;

  return (
    <div className="stack">
      {envelope.warnings.length > 0 && (
        <div className="status-banner warn">{envelope.warnings.join(" · ")}</div>
      )}

      <Card sectionLabel="Technical Standards">
        <div className="grid grid-3">
          <div className="stat-card">
            <div className="stat-card-row">
              <span className="stat-card-label">
                Sitemap
                <Tip text="Whether a sitemap.xml was found and how many URLs it lists — helps search engines discover and crawl every page." />
              </span>
              {sitemap ? <Badge tone={sitemap.found ? "good" : "bad"}>{sitemap.found ? "Found" : "Missing"}</Badge> : <Badge tone="neutral">–</Badge>}
            </div>
            <span className="stat-card-value">{sitemap?.url_count != null ? `${fmtInt(sitemap.url_count)} URLs` : "–"}</span>
            {sitemap?.sitemap_url && <span className="stat-card-sub">{sitemap.sitemap_url}</span>}
            {sitemap?.freshness && (
              <span className="stat-card-sub">
                {fmtInt(sitemap.freshness.pages_with_lastmod)} of {fmtInt((sitemap.freshness.pages_with_lastmod ?? 0) + (sitemap.freshness.pages_without_lastmod ?? 0))} URLs carry a &lt;lastmod&gt; date
                {sitemap.freshness.most_recent_lastmod && <>, newest {sitemap.freshness.most_recent_lastmod}</>}
                {sitemap.freshness.pages_stale_over_1y != null && sitemap.freshness.pages_stale_over_1y > 0 && (
                  <>, {fmtInt(sitemap.freshness.pages_stale_over_1y)} not updated in over a year</>
                )}
              </span>
            )}
          </div>
          <div className="stat-card">
            <div className="stat-card-row">
              <span className="stat-card-label">
                SSL Certificate
                <Tip text="Validity and expiry of the site's HTTPS certificate. An expired certificate blocks visitors and search crawlers entirely." />
              </span>
              {ssl ? <Badge tone={ssl.is_expired ? "bad" : ssl.is_expiring_soon ? "warn" : "good"}>{ssl.is_expired ? "Expired" : ssl.is_expiring_soon ? "Expiring soon" : "Valid"}</Badge> : <Badge tone="neutral">–</Badge>}
            </div>
            <span className="stat-card-value">{ssl?.days_remaining != null ? `${ssl.days_remaining} days left` : "–"}</span>
            {ssl?.issuer && <span className="stat-card-sub">Issued by {ssl.issuer}</span>}
          </div>
          <div className="stat-card">
            <div className="stat-card-row">
              <span className="stat-card-label">
                HTML Syntax
                <Tip text="Number of HTML validation errors on the page — malformed markup can affect rendering, SEO and screen-reader compatibility." />
              </span>
              {html ? <Badge tone={html.is_valid ? "good" : "warn"}>{html.is_valid ? "Valid" : "Errors found"}</Badge> : <Badge tone="neutral">–</Badge>}
            </div>
            <span className="stat-card-value">{html ? `${fmtInt(html.total_errors)} errors` : "–"}</span>
          </div>
        </div>
      </Card>

      {html && html.errors.length > 0 && (
        <Card sectionLabel="HTML Validation Errors">
          <DataTable columns={htmlErrorColumns} rows={html.errors} emptyMessage="No HTML validation errors" maxHeight={260} />
          {html.errors_truncated && (
            <p className="note-text">Showing the first {fmtInt(html.errors.length)} errors — this page has more than that; only {fmtInt(html.errors.length)} are listed here.</p>
          )}
        </Card>
      )}

      <Card
        sectionLabel="WCAG Accessibility Issues"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Tip text="0–100 accessibility score derived from the number and severity of WCAG issues found on the page." />
            <GaugeRing value={wcag?.score ?? null} size={64} strokeWidth={6} unit="SCORE" />
          </div>
        }
      >
        {wcag && (
          <div style={{ marginBottom: 18 }}>
            <p className="section-label" style={{ marginBottom: 8 }}>
              Issue Breakdown by Severity
              <Tip text="How many distinct issue types were found at each severity level - matches the counts below." />
            </p>
            {wcagCounts!.critical + wcagCounts!.serious + wcagCounts!.moderate + wcagCounts!.minor === 0 ? (
              <DistributionBar
                segments={[{ label: "No issues", value: 1, color: "var(--accent-green, #22c55e)" }]}
              />
            ) : (
              <DistributionBar
                segments={[
                  { label: "Critical", value: wcagCounts!.critical, color: "var(--accent-red)" },
                  { label: "Serious", value: wcagCounts!.serious, color: "var(--accent-orange)" },
                  { label: "Moderate", value: wcagCounts!.moderate, color: "var(--accent-yellow)" },
                  { label: "Minor", value: wcagCounts!.minor, color: "var(--accent-blue)" },
                ]}
              />
            )}
          </div>
        )}
        <div className="grid grid-4" style={{ marginBottom: 18 }}>
          <div className="stat-card" style={{ alignItems: "center", textAlign: "center" }}>
            <span className="stat-card-label">Critical</span>
            <span className="stat-card-value" style={{ color: "var(--accent-red)" }}>{fmtInt(wcag?.by_impact?.critical)}</span>
          </div>
          <div className="stat-card" style={{ alignItems: "center", textAlign: "center" }}>
            <span className="stat-card-label">Serious</span>
            <span className="stat-card-value" style={{ color: "var(--accent-orange)" }}>{fmtInt(wcag?.by_impact?.serious)}</span>
          </div>
          <div className="stat-card" style={{ alignItems: "center", textAlign: "center" }}>
            <span className="stat-card-label">Moderate</span>
            <span className="stat-card-value" style={{ color: "var(--accent-yellow)" }}>{fmtInt(wcag?.by_impact?.moderate)}</span>
          </div>
          <div className="stat-card" style={{ alignItems: "center", textAlign: "center" }}>
            <span className="stat-card-label">Minor</span>
            <span className="stat-card-value" style={{ color: "var(--accent-blue)" }}>{fmtInt(wcag?.by_impact?.minor)}</span>
          </div>
        </div>
        <DataTable columns={issueColumns} rows={wcag?.issues ?? []} emptyMessage="No WCAG issues detected" maxHeight={260} />
        {wcag?.total_occurrences != null && wcag.total_occurrences !== wcag.total_issues && (
          <p className="note-text">
            {fmtInt(wcag.total_issues)} distinct issue type{wcag.total_issues === 1 ? "" : "s"} found, affecting {fmtInt(wcag.total_occurrences)} element{wcag.total_occurrences === 1 ? "" : "s"} in total — the "Count" column above shows how many elements each row covers.
          </p>
        )}
        {wcag?.engine_note && <p className="note-text">{wcag.engine_note}</p>}
      </Card>

      <Card sectionLabel="GDPR & Cookie Banner">
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <span className="stat-card-label">
              CMP Provider
              <Tip text="The cookie consent management platform detected on the site, if any." />
            </span>
            <span className="stat-card-value">{gdpr?.banner?.cmp_provider && gdpr.banner.cmp_provider !== "None" ? gdpr.banner.cmp_provider : "–"}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">
              Banner Found
              <Tip text="Whether a cookie consent banner was detected on page load." />
            </span>
            <span className="stat-card-value">
              {gdpr ? <Badge tone={gdpr.banner?.banner_detected ? "good" : "bad"}>{gdpr.banner?.banner_detected ? "Yes" : "No"}</Badge> : "–"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">
              Pre-Consent Cookies
              <Tip text="Cookies set before the visitor gives consent. Non-essential ones set here can be a GDPR/UK-GDPR compliance risk." />
            </span>
            <span className="stat-card-value">{fmtInt(gdpr?.pre_consent_cookie_count)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">
              Post-Consent Cookies
              <Tip text="Cookies set after the visitor accepts the cookie banner." />
            </span>
            <span className="stat-card-value">{fmtInt(gdpr?.post_consent_cookie_count)}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <Badge tone={gdpr?.policies?.privacy_policy ? "good" : "bad"}>Privacy Policy {gdpr?.policies?.privacy_policy ? "Found" : "Missing"}</Badge>
          <Badge tone={gdpr?.policies?.cookie_policy ? "good" : "bad"}>Cookie Policy {gdpr?.policies?.cookie_policy ? "Found" : "Missing"}</Badge>
          <Badge tone={gdpr?.policies?.terms_of_service ? "good" : "bad"}>Terms {gdpr?.policies?.terms_of_service ? "Found" : "Missing"}</Badge>
          {gdpr?.non_essential_preconsent_risk && <Badge tone="warn">Non-essential cookies set pre-consent</Badge>}
        </div>
        <p className="section-label" style={{ marginBottom: 10 }}>Cookies Detected</p>
        <DataTable columns={cookieColumns} rows={gdpr?.cookies_detected ?? []} emptyMessage="No cookies detected" maxHeight={220} />
        <p className="note-text">
          "Third-party" cookies here are genuinely set by something embedded on the page (e.g. a LinkedIn Insight Tag,
          a share button, an ads/analytics pixel) — the browser records every cookie set while the page loads, not
          just ones from {targetHost !== "–" ? targetHost : "the target domain"} itself. That's not a bug: those
          third-party trackers being set before consent is exactly the kind of thing a GDPR check is meant to catch.
        </p>
      </Card>
    </div>
  );
}
