import type { CoreWebVitals, Envelope, Topic2Data } from "../types/audit";
import Card from "../components/ui/Card";
import GaugeRing from "../components/ui/GaugeRing";
import Badge from "../components/ui/Badge";
import Tip from "../components/ui/Tip";
import DistributionBar from "../components/charts/DistributionBar";
import { fmtInt, fmtMs } from "../lib/format";

function cwvColor(ms: number | null, good: number, poor: number): string {
  if (ms === null) return "var(--text-tertiary)";
  if (ms <= good) return "var(--accent)";
  if (ms <= poor) return "var(--accent-amber)";
  return "var(--accent-red)";
}

// Deterministic per-status-code color, grouped by family so the sectioned
// bar below reads at a glance: 200 is the one truly healthy state (green),
// 404 and 429 get their own fixed colors since they're the two codes people
// specifically watch for, every other 4xx gets a red shade, and 3xx gets an
// orange/yellow shade - the exact hue within each family shifts with the
// code itself so neighbouring codes (e.g. 401 vs 403) are still visually
// distinguishable rather than a single flat block.
function statusCodeColor(codeStr: string): string {
  const n = parseInt(codeStr, 10);
  if (Number.isNaN(n)) return "var(--text-tertiary)";
  if (n === 200) return "var(--accent)";
  if (n >= 200 && n < 300) return `hsl(160, 55%, ${58 - ((n - 200) % 5) * 4}%)`;
  if (n >= 300 && n < 400) return `hsl(${38 + ((n - 300) * 11) % 40}, 85%, 55%)`;
  if (n === 429) return "hsl(270, 60%, 58%)";
  if (n === 404) return "var(--accent-red)";
  if (n >= 400 && n < 500) return `hsl(${350 + ((n - 400) * 7) % 20}, 70%, ${48 - ((n - 400) % 4) * 5}%)`;
  if (n >= 500) return "hsl(0, 55%, 32%)";
  return "var(--text-tertiary)";
}

// Renders the performance-score gauge + LCP/TBT/CLS trio for one Lighthouse
// strategy (mobile or desktop) - extracted so Topic 2 can show both runs
// side by side without duplicating the gauge-color logic twice.
function CoreWebVitalsPanel({ cwv, label }: { cwv: CoreWebVitals | null | undefined; label: string }) {
  return (
    <Card
      sectionLabel={`Core Web Vitals — ${label}`}
      right={
        cwv?.performance_score != null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Tip text={`Google Lighthouse's overall 0–100 performance score (lab data, single simulated ${label.toLowerCase()} run).`} />
            <GaugeRing value={cwv.performance_score} size={64} strokeWidth={6} unit="PERF SCORE" />
          </div>
        ) : undefined
      }
    >
      <div className="grid grid-3">
        <div className="stat-card" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="stat-card-label">
            LCP
            <Tip text="Largest Contentful Paint — how long the biggest visible element takes to render. Under 2.5s is good." />
          </span>
          <GaugeRing
            value={cwv?.lcp_ms != null ? Math.min(100, 100 - Math.max(0, ((cwv.lcp_ms - 2500) / 6000) * 100)) : null}
            displayValue={cwv?.lcp_ms != null ? fmtMs(cwv.lcp_ms) : "–"}
            color={cwvColor(cwv?.lcp_ms ?? null, 2500, 4000)}
            size={82}
            strokeWidth={7}
            small
          />
        </div>
        <div className="stat-card" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="stat-card-label">
            TBT (INP proxy)
            <Tip text="Total Blocking Time — how long the main thread was blocked during load. Used here as a lab-data proxy for interactivity (INP)." />
          </span>
          <GaugeRing
            value={cwv?.total_blocking_time_ms != null ? Math.min(100, 100 - Math.max(0, (cwv.total_blocking_time_ms / 600) * 100)) : null}
            displayValue={cwv?.total_blocking_time_ms != null ? fmtMs(cwv.total_blocking_time_ms) : "–"}
            color={cwvColor(cwv?.total_blocking_time_ms ?? null, 200, 600)}
            size={82}
            strokeWidth={7}
            small
          />
        </div>
        <div className="stat-card" style={{ alignItems: "center", textAlign: "center" }}>
          <span className="stat-card-label">
            CLS
            <Tip text="Cumulative Layout Shift — how much visible content unexpectedly moves during load. Lower is better; under 0.1 is good." />
          </span>
          <GaugeRing
            value={cwv?.cls != null ? Math.min(100, 100 - cwv.cls * 400) : null}
            displayValue={cwv?.cls != null ? cwv.cls.toFixed(3) : "–"}
            color={cwv?.cls != null ? cwvColor(cwv.cls * 1000, 100, 250) : "var(--text-tertiary)"}
            size={82}
            strokeWidth={7}
            small
          />
        </div>
      </div>
      {cwv?.opportunities && cwv.opportunities.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="section-label" style={{ marginBottom: 8 }}>
            Optimization Opportunities
            <Tip text="Extra Lighthouse audits beyond the headline Core Web Vitals — concrete, zero-guesswork fixes ranked by estimated load-time savings." />
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cwv.opportunities.map((o) => (
              <div key={o.id} className="form-card-row">
                <span>{o.label}</span>
                <b>{o.display_value ?? fmtMs(o.estimated_savings_ms)}</b>
              </div>
            ))}
          </div>
        </div>
      )}
      {cwv?.inp_note && <p className="note-text">{cwv.inp_note}</p>}
    </Card>
  );
}

export default function Topic2Performance({ envelope }: { envelope: Envelope<Topic2Data> }) {
  const d = envelope.data;
  const cwvMobile = d.core_web_vitals?.mobile ?? null;
  const cwvDesktop = d.core_web_vitals?.desktop ?? null;
  const tech = d.tech_metrics;
  const meta = d.metadata_analysis;
  const runWarnings = [...(cwvMobile?.diagnostics?.run_warnings ?? []), ...(cwvDesktop?.diagnostics?.run_warnings ?? [])];
  const redirectedDiag = cwvMobile?.diagnostics?.redirected ? cwvMobile.diagnostics : cwvDesktop?.diagnostics?.redirected ? cwvDesktop.diagnostics : null;
  const statusBreakdown = meta?.indexation_errors_by_status_code;
  const statusEntries = statusBreakdown ? Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="stack">
      {envelope.warnings.length > 0 && <div className="status-banner warn">{envelope.warnings.join(" · ")}</div>}
      {runWarnings.length > 0 && (
        <div className="status-banner info">
          Lighthouse note: {runWarnings.join(" ")}
          {redirectedDiag?.final_url && <> Measured page: <b>{redirectedDiag.final_url}</b></>}
        </div>
      )}

      <div className="grid grid-2">
        <CoreWebVitalsPanel cwv={cwvMobile} label="Mobile" />
        <CoreWebVitalsPanel cwv={cwvDesktop} label="Desktop" />
      </div>

      <Card sectionLabel="Metadata Analysis">
        <div className="table-scroll" style={{ marginBottom: 20 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Element</th>
                <th className="num">Missing</th>
                <th className="num">Duplicate</th>
                <th className="num">Multiple</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Title Tags</td>
                <td className="num">{fmtInt(meta?.meta_counts?.title?.missing)}</td>
                <td className="num">{fmtInt(meta?.meta_counts?.title?.duplicate)}</td>
                <td className="num">{fmtInt(meta?.meta_counts?.title?.multiple)}</td>
              </tr>
              <tr>
                <td>Meta Descriptions</td>
                <td className="num">{fmtInt(meta?.meta_counts?.description?.missing)}</td>
                <td className="num">{fmtInt(meta?.meta_counts?.description?.duplicate)}</td>
                <td className="num">{fmtInt(meta?.meta_counts?.description?.multiple)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="two-col">
          <div>
            <p className="section-label">Title Tag Length</p>
            {meta?.title_distribution ? (
              <DistributionBar
                segments={[
                  { label: "Under 30", value: meta.title_distribution.under, color: "var(--accent-amber)" },
                  { label: "Optimal", value: meta.title_distribution.optimal, color: "var(--accent)" },
                  { label: "Over 60", value: meta.title_distribution.over, color: "var(--accent-red)" },
                ]}
              />
            ) : (
              <div className="chart-empty">No Screaming Frog data</div>
            )}
          </div>
          <div>
            <p className="section-label">Meta Description Length</p>
            {meta?.description_distribution ? (
              <DistributionBar
                segments={[
                  { label: "Under 120", value: meta.description_distribution.under, color: "var(--accent-amber)" },
                  { label: "Optimal", value: meta.description_distribution.optimal, color: "var(--accent)" },
                  { label: "Over 158", value: meta.description_distribution.over, color: "var(--accent-red)" },
                ]}
              />
            ) : (
              <div className="chart-empty">No Screaming Frog data</div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-3">
        <div className="stat-card">
          <span className="stat-card-label">
            Page Size
            <Tip text="Total downloaded weight of the page, in kilobytes." />
          </span>
          <span className="stat-card-value">{tech?.page_size_kb != null ? `${tech.page_size_kb} KB` : "–"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Load Time
            <Tip text="Full time to fetch the page over the network, end to end." />
          </span>
          <span className="stat-card-value">{tech?.load_time_ms != null ? fmtMs(tech.load_time_ms) : "–"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Status Code
            <Tip text="HTTP response code returned by the page. 200 is healthy." />
          </span>
          <span className="stat-card-value">
            {tech?.status_code != null ? <Badge tone={tech.status_code === 200 ? "good" : "bad"}>{tech.status_code}</Badge> : "–"}
          </span>
        </div>
      </div>

      <Card sectionLabel="Indexation Errors by Status Code">
        <p className="stat-card-value" style={{ marginBottom: 12 }}>
          {fmtInt(meta?.indexation_errors_count)}
          <Tip text="Number of crawled URLs marked non-indexable by search engines, broken down below by the status code that caused it." />
        </p>
        {statusEntries.length > 0 ? (
          <DistributionBar
            segments={statusEntries.map(([code, count]) => ({
              label: code,
              value: count,
              color: statusCodeColor(code),
            }))}
          />
        ) : (
          <div className="chart-empty">No indexation errors found</div>
        )}
      </Card>
      {tech?.ttfb_note && <p className="note-text">{tech.ttfb_note}</p>}
    </div>
  );
}
