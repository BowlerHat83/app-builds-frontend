import type { Envelope, Topic6Data } from "../types/audit";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Tip from "../components/ui/Tip";
import DataTable, { Column } from "../components/ui/DataTable";
import { fmtInt, fmtPercent, fmtDash } from "../lib/format";
import { resolveAssetUrl } from "../api/client";
import type { MapPackKeywordRow } from "../types/audit";

export default function Topic6Local({ envelope }: { envelope: Envelope<Topic6Data> }) {
  const d = envelope.data;
  const citations = d.citations;
  const mapPack = d.map_pack;
  const reviews = d.reviews;
  const screenshot = d.profile_screenshot;
  const screenshotUrl = resolveAssetUrl(screenshot?.relative_path);

  const keywordColumns: Column<MapPackKeywordRow>[] = [
    { key: "keyword", header: "Keyword", render: (r) => r.keyword },
    {
      key: "pos",
      header: "Map Pack Position",
      align: "right",
      render: (r) => (r.found ? <Badge tone="good">#{r.map_pack_position}</Badge> : <Badge tone="neutral">Not in pack</Badge>),
    },
  ];

  return (
    <div className="stack">
      {envelope.warnings.length > 0 && <div className="status-banner warn">{envelope.warnings.join(" · ")}</div>}

      <div className="grid grid-3">
        <div className="stat-card">
          <span className="stat-card-label">
            NAP Consistency
            <Tip text="How consistently the business Name, Address and Phone number appear across citation listings. Inconsistent NAP data can hurt local rankings." />
          </span>
          <span className="stat-card-value">{citations ? fmtPercent(citations.nap_consistency_score) : "–"}</span>
          <span className="stat-card-sub">{fmtInt(citations?.active_citations)} active of {fmtInt(citations?.total_citations)} citations</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            High-Authority Citations
            <Tip text="Citations from higher domain-authority directories and sites, which typically carry more local-ranking weight." />
          </span>
          <span className="stat-card-value">{fmtInt(citations?.high_authority_citations)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Avg Map Pack Rank
            <Tip text="Average position in Google's local 3-pack across all tracked keywords — branded and, where available, unbranded terms from Organic, AI and PPC." />
          </span>
          <span className="stat-card-value">{fmtDash(mapPack?.average_map_pack_position)}</span>
          <span className="stat-card-sub">{fmtInt(mapPack?.keywords_in_map_pack)} of {fmtInt(mapPack?.total_keywords_tracked)} keywords tracked</span>
        </div>
      </div>

      <Card
        sectionLabel="Screenshot of Profile"
        right={screenshot?.source ? <span className="cell-muted" style={{ fontSize: 11.5 }}>Source: {screenshot.source}</span> : undefined}
      >
        <div className="form-card-shot" style={{ height: 460, maxWidth: 620, margin: "0 auto", borderRadius: 12, border: "1px solid var(--border)" }}>
          {screenshotUrl && screenshot?.status === "captured" ? (
            <img src={screenshotUrl} alt="Google Business Profile screenshot" />
          ) : (
            <span className="placeholder">{screenshot?.status ? `Screenshot ${screenshot.status}` : "No screenshot available"}</span>
          )}
        </div>
      </Card>

      <Card
        sectionLabel="Map Pack Keyword Breakdown"
        right={<Tip text="Each keyword tested against Google's local 3-pack, and whether — and where — this business appeared." />}
      >
        <DataTable columns={keywordColumns} rows={mapPack?.keyword_breakdown ?? []} maxHeight={280} />
      </Card>

      <Card sectionLabel="Reviews">
        <div className="grid grid-2" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <span className="stat-card-label">
              No. of Reviews
              <Tip text="Total number of reviews on the Google Business Profile." />
            </span>
            <span className="stat-card-value">{reviews?.gbp_metrics ? fmtInt(reviews.gbp_metrics.total_reviews) : "–"}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">
              Average Rating
              <Tip text="Average star rating across all Google Business Profile reviews." />
            </span>
            <span className="stat-card-value">
              {reviews?.gbp_metrics ? (
                <>
                  {reviews.gbp_metrics.average_rating.toFixed(1)} <span className="review-stars">{reviews.gbp_metrics.rating_stars}</span>
                </>
              ) : (
                "–"
              )}
            </span>
          </div>
        </div>
        <p className="section-label">Top Reviews</p>
        {reviews?.top_reviews && reviews.top_reviews.length > 0 ? (
          <div className="grid grid-2">
            {reviews.top_reviews.map((r, i) => (
              <div key={i} className="review-card">
                <div className="review-card-head">
                  <span className="review-card-author">{r.author}</span>
                  <span className="review-card-date">{r.date}</span>
                </div>
                <span className="review-stars">{"★".repeat(Math.round(r.rating))}{"☆".repeat(5 - Math.round(r.rating))}</span>
                <p className="review-snippet">{r.snippet}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="chart-empty">{reviews?.note ?? reviews?.error ?? "No review data available"}</div>
        )}
      </Card>
    </div>
  );
}
