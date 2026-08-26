import type { Envelope, Topic3Data, TopKeywordRow, ContentGapRow } from "../types/audit";
import Card from "../components/ui/Card";
import DataTable, { Column } from "../components/ui/DataTable";
import Tip from "../components/ui/Tip";
import PieChart from "../components/charts/PieChart";
import LineChart from "../components/charts/LineChart";
import { fmtInt, fmtPercent, fmtDash } from "../lib/format";

export default function Topic3Organic({ envelope }: { envelope: Envelope<Topic3Data> }) {
  const d = envelope.data;
  const backlinks = d.backlinks_summary;
  const dr = d.domain_rating;
  const share = d.competitor_share;
  const kp = d.keyword_position;
  const traffic = d.traffic_impressions;
  const history = d.historic_traffic_estimate;
  const branded = d.branded_traffic;

  const keywordColumns: Column<TopKeywordRow>[] = [
    { key: "keyword", header: "Keyword", render: (r) => r.keyword },
    { key: "imp", header: "Imp/mo", align: "right", render: (r) => fmtInt(r.impressions_volume) },
    { key: "clicks", header: "Clicks", align: "right", render: (r) => fmtInt(r.estimated_clicks) },
    { key: "pos", header: "Pos", align: "right", render: (r) => fmtDash(r.average_position) },
  ];

  const gapColumns: Column<ContentGapRow>[] = [
    { key: "keyword", header: "Topic / Opportunity", render: (r) => r.keyword },
    { key: "vol", header: "Est. Vol", align: "right", render: (r) => fmtInt(r.search_volume) },
    {
      key: "priority",
      header: "Priority",
      align: "right",
      render: (r) => (
        <span className={r.opportunity_priority === "High" ? "chip-high" : r.opportunity_priority === "Medium" ? "chip-medium" : "chip-low"}>
          {r.opportunity_priority}
        </span>
      ),
    },
  ];

  const marketSharePie = (share?.market_share_breakdown ?? []).slice(0, 8).map((r) => ({
    label: r.domain,
    value: r.market_share_percent,
    sublabel: `${r.common_keywords} shared kw`,
  }));

  const trendPoints = (history?.monthly_history_12m ?? []).map((p) => ({ label: p.month.split(" ")[0], value: p.estimated_organic_traffic }));

  const brandedBlock = branded?.traffic_breakdown?.branded;
  const unbrandedBlock = branded?.traffic_breakdown?.unbranded;
  const brandedPct = brandedBlock?.traffic_percentage ?? null;
  const unbrandedPct = unbrandedBlock?.traffic_percentage ?? null;
  const brandedVsUnbrandedPie =
    brandedBlock && unbrandedBlock
      ? [
          { label: "Branded", value: brandedBlock.estimated_monthly_traffic, color: "var(--accent)" },
          { label: "Unbranded", value: unbrandedBlock.estimated_monthly_traffic, color: "var(--accent-blue)" },
        ]
      : [];

  return (
    <div className="stack">
      {envelope.warnings.length > 0 && <div className="status-banner warn">{envelope.warnings.join(" · ")}</div>}

      <div className="grid grid-4">
        <div className="stat-card">
          <span className="stat-card-label">
            Backlinks
            <Tip text="Total inbound links pointing at the site, and how many unique domains they come from." />
          </span>
          <span className="stat-card-value">{fmtInt(backlinks?.total_backlinks)}</span>
          <span className="stat-card-sub">{fmtInt(backlinks?.unique_referring_domains)} referring domains</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Total Impressions (30d)
            <Tip text="Estimated organic search impressions over the last 30 days, modeled from Ahrefs keyword data." />
          </span>
          <span className="stat-card-value">{fmtInt(traffic?.metrics?.estimated_impressions_potential)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Total Clicks (30d)
            <Tip text="Estimated organic search clicks over the last 30 days, modeled from Ahrefs keyword data." />
          </span>
          <span className="stat-card-value">{fmtInt(traffic?.metrics?.estimated_organic_clicks)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Avg Keyword Position
            <Tip text="Average ranking position across every tracked organic keyword — lower is better." />
          </span>
          <span className="stat-card-value">{fmtDash(kp?.metrics?.average_position)}</span>
          <span className="stat-card-sub">{fmtInt(kp?.metrics?.top_10_count)} of {fmtInt(kp?.metrics?.total_keywords_analyzed)} in top 10</span>
        </div>
      </div>

      <Card
        sectionLabel={`Competitor Share Breakdown${dr ? ` · Avg competitor DR ${fmtInt(dr.metrics?.average_competitor_dr)}` : ""}`}
        right={<Tip text="Share of overlapping keyword rankings held by each competitor domain — a bigger slice means they compete for more of the same search terms." />}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <PieChart data={marketSharePie} valueFormatter={(v) => fmtPercent(v, 1)} />
        </div>
      </Card>

      <Card
        sectionLabel="Branded vs Unbranded Traffic"
        right={<Tip text="Branded = searches containing the business's own name. Unbranded = generic/category searches — the traffic a competitor could just as easily win." />}
      >
        {brandedBlock && unbrandedBlock ? (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <PieChart
                data={brandedVsUnbrandedPie}
                valueFormatter={(v) => `${fmtInt(v)} visits/mo`}
              />
            </div>
            <div className="grid grid-2">
              <div className="stat-card">
                <span className="stat-card-label">Branded Keywords</span>
                <span className="stat-card-value">{fmtInt(brandedBlock.keyword_count)}</span>
                <span className="stat-card-sub">{fmtPercent(brandedBlock.keyword_percentage, 1)} of tracked keywords · {fmtPercent(brandedPct, 1)} of traffic</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Unbranded Keywords</span>
                <span className="stat-card-value">{fmtInt(unbrandedBlock.keyword_count)}</span>
                <span className="stat-card-sub">{fmtPercent(unbrandedBlock.keyword_percentage, 1)} of tracked keywords · {fmtPercent(unbrandedPct, 1)} of traffic</span>
              </div>
            </div>
          </>
        ) : (
          <div className="chart-empty">No data available</div>
        )}
      </Card>

      <div className="two-col">
        <Card sectionLabel="Keywords">
          <DataTable columns={keywordColumns} rows={d.top_keywords?.top_keywords ?? []} maxHeight={320} />
        </Card>
        <Card
          sectionLabel="Content Gaps"
          right={<Tip text="Real search terms with volume that the site doesn't rank well for yet — genuine content opportunities, not competitors' or directories' own pages." />}
        >
          <DataTable columns={gapColumns} rows={d.content_gaps?.content_gaps ?? []} maxHeight={320} />
        </Card>
      </div>

      <Card sectionLabel="Organic Traffic Trend (12mo)">
        <div className="chart-box">
          <LineChart data={trendPoints} valueFormatter={(v) => fmtInt(v)} />
        </div>
        {history?.methodology_note && <p className="note-text">{history.methodology_note}</p>}
      </Card>
    </div>
  );
}
