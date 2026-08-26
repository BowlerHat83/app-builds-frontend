import type { Envelope, Topic5Data, PPCKeywordRow } from "../types/audit";
import Card from "../components/ui/Card";
import DataTable, { Column } from "../components/ui/DataTable";
import BarChart from "../components/charts/BarChart";
import Tip from "../components/ui/Tip";
import { fmtInt, fmtCurrencyGBP } from "../lib/format";

export default function Topic5Paid({ envelope }: { envelope: Envelope<Topic5Data> }) {
  const d = envelope.data;
  const kw = d.keywords;
  const share = d.competitor_share;

  const keywordColumns: Column<PPCKeywordRow>[] = [
    { key: "keyword", header: "Top Keywords", render: (r) => r.keyword },
    { key: "vol", header: "Est. Volume", align: "right", render: (r) => fmtInt(r.search_volume) },
    { key: "cpc", header: "CPC", align: "right", render: (r) => fmtCurrencyGBP(r.cpc) },
  ];

  const competitorBars = (share?.competitor_share_breakdown ?? []).slice(0, 8).map((c) => ({
    label: c.domain,
    value: c.monthly_ad_budget,
    sublabel: `${c.monthly_paid_keywords} paid keywords`,
  }));

  return (
    <div className="stack">
      {envelope.warnings.length > 0 && <div className="status-banner warn">{envelope.warnings.join(" · ")}</div>}

      <div className="grid grid-4">
        <div className="stat-card">
          <span className="stat-card-label">
            No. of Keywords
            <Tip text="Total number of paid keywords found in the PPC keyword-research export." />
          </span>
          <span className="stat-card-value">{fmtInt(kw?.total_keywords)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Est. Monthly Spend
            <Tip text="Estimated monthly ad spend, based on exact-match CPC × click volume — see the methodology note below for other match types." />
          </span>
          <span className="stat-card-value">{kw ? fmtCurrencyGBP(kw.estimated_monthly_spend) : "–"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Average CPC
            <Tip text="Average cost-per-click across tracked keywords with a nonzero exact-match CPC." />
          </span>
          <span className="stat-card-value">{kw?.average_cpc != null ? fmtCurrencyGBP(kw.average_cpc) : "–"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            No. of Clicks
            <Tip text="Total estimated monthly clicks across tracked paid keywords." />
          </span>
          <span className="stat-card-value">{fmtInt(kw?.total_monthly_clicks)}</span>
        </div>
      </div>

      <Card
        sectionLabel={`Competitor Share Breakdown${share ? ` · ${share.total_competitors_analyzed} competitors analyzed` : ""}`}
        right={<Tip text="Estimated monthly ad budget for each competitor domain, from the PPC competitor-overlap export." />}
      >
        <BarChart data={competitorBars} color="var(--accent-orange)" valueFormatter={(v) => fmtCurrencyGBP(v)} />
      </Card>

      <Card sectionLabel="Top Keywords">
        <DataTable columns={keywordColumns} rows={kw?.top_keywords ?? []} maxHeight={320} />
        {kw?.methodology_note && <p className="note-text">{kw.methodology_note}</p>}
      </Card>
    </div>
  );
}
