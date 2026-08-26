import type { Envelope, Topic2Data } from "../types/audit";
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

export default function Topic2Performance({ envelope }: { envelope: Envelope<Topic2Data> }) {
  const d = envelope.data;
  const cwv = d.core_web_vitals;
  const tech = d.tech_metrics;
  const meta = d.metadata_analysis;
  const diag = cwv?.diagnostics;
  const statusBreakdown = meta?.indexation_errors_by_status_code;
  const statusEntries = statusBreakdown ? Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="stack">
      {envelope.warnings.length > 0 && <div className="status-banner warn">{envelope.warnings.join(" · ")}</div>}
      {diag?.run_warnings && diag.run_warnings.length > 0 && (
        <div className="status-banner info">
          Lighthouse note: {diag.run_warnings.join(" ")}
          {diag.redirected && diag.final_url && <> Measured page: <b>{diag.final_url}</b></>}
        </div>
      )}

      <Card
        sectionLabel="Core Web Vitals"
        right={
          cwv?.performance_score != null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Tip text="Google Lighthouse's overall 0–100 performance score (lab data, single simulated run)." />
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
        {cwv?.inp_note && <p className="note-text">{cwv.inp_note}</p>}
      </Card>

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

      <div className="grid grid-4">
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
        <div className="stat-card">
          <span className="stat-card-label">
            Indexation Errors
            <Tip text="Number of crawled URLs marked non-indexable by search engines — see the breakdown by status code below." />
          </span>
          <span className="stat-card-value">{fmtInt(meta?.indexation_errors_count)}</span>
          {statusEntries.length > 0 && (
            <div className="status-chip-row">
              {statusEntries.map(([code, count]) => (
                <span key={code} className="status-chip">
                  {code} <span className="count">×{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {tech?.ttfb_note && <p className="note-text">{tech.ttfb_note}</p>}
    </div>
  );
}
