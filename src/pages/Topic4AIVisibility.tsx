import type { Envelope, Topic4Data, AIKeywordRow, TopTargetUrlRow } from "../types/audit";
import Card from "../components/ui/Card";
import Tip from "../components/ui/Tip";
import DataTable, { Column } from "../components/ui/DataTable";
import PieChart from "../components/charts/PieChart";
import { fmtInt, truncate } from "../lib/format";

export default function Topic4AIVisibility({ envelope }: { envelope: Envelope<Topic4Data>; targetUrl: string }) {
  const d = envelope.data;
  const engines = d.engine_visibility?.engine_visibility_breakdown ?? [];
  const ratio = d.summary?.engine_visibility_ratio;

  const keywordColumns: Column<AIKeywordRow>[] = [
    { key: "keyword", header: "Search Term", render: (r) => r.keyword },
    { key: "occ", header: "Visibility", align: "right", render: (r) => fmtInt(r.occurrences) },
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

      <div className="two-col">
        <Card
          sectionLabel="Top Visible Search Terms"
          right={<Tip text="Prompts/topics where the site's content was surfaced by an AI engine. These aren't attributable to a single page, so they can't be scoped to one domain the way page citations can." />}
        >
          <DataTable columns={keywordColumns} rows={d.top_keywords?.top_keywords ?? []} maxHeight={300} />
        </Card>
        <Card
          sectionLabel="Top Cited Pages"
          right={<Tip text="The target domain's own individual pages, ranked by how many times each was cited by an AI engine — competitor and third-party sources are excluded." />}
        >
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
