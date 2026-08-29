import type { Envelope, Topic4Data, TopSearchTermRow, TopTargetUrlRow } from "../types/audit";
import Card from "../components/ui/Card";
import Tip from "../components/ui/Tip";
import DataTable, { Column } from "../components/ui/DataTable";
import PieChart from "../components/charts/PieChart";
import { fmtInt, truncate } from "../lib/format";

export default function Topic4AIVisibility({ envelope }: { envelope: Envelope<Topic4Data>; targetUrl: string }) {
  const d = envelope.data;
  const engines = d.engine_visibility?.engine_visibility_breakdown ?? [];
  const ratio = d.summary?.engine_visibility_ratio;

  const searchTermColumns: Column<TopSearchTermRow>[] = [
    { key: "prompt", header: "Search Prompt", render: (r) => r.prompt },
    { key: "occ", header: "Occurrences", align: "right", render: (r) => fmtInt(r.occurrences) },
  ];

  const targetUrlColumns: Column<TopTargetUrlRow>[] = [
    { key: "url", header: "Page", render: (r) => <span className="cell-mono">{truncate(r.url, 52)}</span> },
    { key: "category", header: "Category", render: (r) => <span className="cell-muted">{r.category}</span> },
    { key: "citations", header: "Citations", align: "right", render: (r) => fmtInt(r.citations) },
  ];

  const enginePie = engines
    .filter((e) => e.source_count > 0)
    .map((e) => ({ label: e.engine, value: e.source_count }));

  const competitorPie = (d.top_competitors?.top_competitors ?? []).slice(0, 8).map((c) => ({ label: c.domain, value: c.citations }));

  const targetUrls = d.top_target_urls;
  const searchTerms = d.top_search_terms;
  const factsOverview = d.facts_overview;
  const statusEntries = factsOverview?.status_breakdown
    ? Object.entries(factsOverview.status_breakdown).sort((a, b) => b[1] - a[1])
    : [];
  const dateRange = factsOverview?.date_range;

  return (
    <div className="stack">
      {envelope.warnings.length > 0 && <div className="status-banner warn">{envelope.warnings.join(" · ")}</div>}

      <Card
        sectionLabel="Main Visibility"
        right={<Tip text="How many of the 4 tracked AI engines (Gemini, Claude, Sonar, GPT) cite this site as a source at all." />}
      >
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 36, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>{ratio ?? "–"}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "var(--text-tertiary)" }}>ENGINES CITING</span>
          </div>
          <PieChart
            data={enginePie}
            emptyMessage="No engine citation data available"
            valueFormatter={(v) => `${fmtInt(v)} sources`}
          />
        </div>
      </Card>

      <Card
        sectionLabel="Competitor Breakdown (citations)"
        right={<Tip text="Citation counts for competitor domains across the same AI engines, for comparison." />}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <PieChart data={competitorPie} valueFormatter={(v) => `${fmtInt(v)} citations`} />
        </div>
      </Card>

      {factsOverview && (statusEntries.length > 0 || dateRange) && (
        <Card
          sectionLabel="Facts Data Overview"
          right={<Tip text="A health check on the uploaded facts export itself — its Status and Date columns, so a stale or unbalanced export is visible rather than silently folded into the metrics above." />}
        >
          <div className="two-col">
            <div>
              <p className="section-label" style={{ marginBottom: 8 }}>
                Status Breakdown
              </p>
              {statusEntries.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {statusEntries.map(([status, count]) => (
                    <div key={status} className="form-card-row">
                      <span>{status}</span>
                      <b>{fmtInt(count)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="chart-empty">No Status column in the facts export</div>
              )}
            </div>
            <div>
              <p className="section-label" style={{ marginBottom: 8 }}>
                Date Coverage
              </p>
              {dateRange ? (
                <p className="note-text" style={{ marginTop: 0 }}>
                  {fmtInt(dateRange.dated_rows)} of {fmtInt(dateRange.total_rows)} rows carry a usable date, spanning{" "}
                  <b>{dateRange.earliest}</b> to <b>{dateRange.latest}</b>.
                </p>
              ) : (
                <div className="chart-empty">No Date column in the facts export</div>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="two-col">
        <Card
          sectionLabel="Top Visible Search Terms"
          right={<Tip text="The actual long-form prompts people (or AI engines standing in for them) put to each AI model — not root-word topics — ranked by how often that exact prompt recurred, capped to the top 10." />}
        >
          <DataTable
            columns={searchTermColumns}
            rows={searchTerms?.top_search_terms ?? []}
            maxHeight={300}
            emptyMessage={searchTerms ? "No prompts found in the facts export" : "No data available"}
          />
        </Card>
        <Card
          sectionLabel="Top Cited Pages"
          right={<Tip text="The target domain's own individual pages, ranked by how many times each was cited by an AI engine — competitor and third-party sources are excluded." />}
        >
          {targetUrls && (
            <p className="note-text" style={{ marginTop: 0, marginBottom: 12 }}>
              {fmtInt(targetUrls.total_distinct_urls)} distinct page{targetUrls.total_distinct_urls === 1 ? "" : "s"} on this domain cited, across{" "}
              {fmtInt(targetUrls.total_citation_rows)} citation row{targetUrls.total_citation_rows === 1 ? "" : "s"} in the sources export.
            </p>
          )}
          <DataTable
            columns={targetUrlColumns}
            rows={targetUrls?.top_target_urls ?? []}
            maxHeight={300}
            emptyMessage={targetUrls ? "No citations found for this domain's own pages among the tracked sources" : "No data available"}
          />
          {targetUrls?.methodology_note && <p className="note-text">{targetUrls.methodology_note}</p>}
        </Card>
      </div>
    </div>
  );
}
