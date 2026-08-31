import type { Envelope, Topic6Data } from "../types/audit";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Tip from "../components/ui/Tip";
import DataTable, { Column } from "../components/ui/DataTable";
import { fmtInt, fmtPercent, fmtDash } from "../lib/format";
import DistributionBar from "../components/charts/DistributionBar";
import { resolveAssetUrl } from "../api/client";
import type { MapPackKeywordRow } from "../types/audit";
import ZoomableImage from "../components/ui/ZoomableImage";

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
      render: (r) =>
        r.in_map_pack ? (
          <Badge tone="good">#{r.local_pack_position}</Badge>
        ) : r.found ? (
          <Badge tone="warn">#{r.local_pack_position} (local results, not in the 3-pack)</Badge>
        ) : (
          <Badge tone="neutral">Not found</Badge>
        ),
    },
  ];

  return (
    <div className="stack">
      {envelope.warnings.length > 0 && <div className="status-banner warn">{envelope.warnings.join(" · ")}</div>}

      <div className="grid grid-4">
        <div className="stat-card">
          <span className="stat-card-label">
            NAP Consistency
            <Tip text="How consistently the business Name, Address and Phone number appear across citation listings that actually have NAP data captured. Inconsistent NAP data can hurt local rankings." />
          </span>
          <span className="stat-card-value">{citations ? fmtPercent(citations.nap_consistency_score) : "–"}</span>
          <span className="stat-card-sub">{fmtInt(citations?.nap_consistency_sample_size)} of {fmtInt(citations?.active_citations)} active citations had NAP data to check</span>
          {citations?.nap_consistency_note && <span className="stat-card-sub" style={{ color: "var(--accent-amber)" }}>{citations.nap_consistency_note}</span>}
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Citation Breakdown
            <Tip text="How this export's rows split between live citations, duplicates BrightLocal flagged, and unclaimed 'Potential' listings not yet counted as citations." />
          </span>
          <span className="stat-card-value">{fmtInt(citations?.total_citations)}</span>
          <span className="stat-card-sub">{fmtInt(citations?.duplicate_citations)} duplicate · {fmtInt(citations?.potential_citation_opportunities)} potential opportunities</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            High-Authority Citations
            <Tip text="Citations from higher domain-authority directories and sites, which typically carry more local-ranking weight." />
          </span>
          <span className="stat-card-value">{fmtInt(citations?.high_authority_citations)}</span>
          {citations?.high_authority_opportunities != null && citations.high_authority_opportunities > 0 && (
            <span className="stat-card-sub">+{fmtInt(citations.high_authority_opportunities)} more among the potential opportunities</span>
          )}
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Avg Map Pack Rank
            <Tip text="Average position in Google's local 3-pack across real customer-search-style keywords built from the Core Offering entered on the intake screen (or branded terms if none was supplied)." />
          </span>
          <span className="stat-card-value">{fmtDash(mapPack?.average_map_pack_position)}</span>
          <span className="stat-card-sub">{fmtInt(mapPack?.keywords_in_map_pack)} of {fmtInt(mapPack?.total_keywords_tracked)} keywords in the 3-pack</span>
          {mapPack?.keywords_found_in_local_results != null && mapPack.keywords_found_in_local_results > (mapPack.keywords_in_map_pack ?? 0) && (
            <span className="stat-card-sub">{fmtInt(mapPack.keywords_found_in_local_results)} found in local results overall (avg pos {fmtDash(mapPack.average_local_search_position)})</span>
          )}
        </div>
      </div>

      <Card
        sectionLabel="Screenshot of Profile"
        right={screenshot?.source ? <span className="cell-muted" style={{ fontSize: 11.5 }}>Source: {screenshot.source}</span> : undefined}
      >
        <div className="form-card-shot" style={{ height: 460, maxWidth: 620, margin: "0 auto", borderRadius: 12, border: "1px solid var(--border)" }}>
          {screenshotUrl && screenshot?.status === "captured" ? (
            <ZoomableImage src={screenshotUrl} alt="Google Business Profile screenshot" />
          ) : (
            <span className="placeholder">{screenshot?.status ? `Screenshot ${screenshot.status}` : "No screenshot available"}</span>
          )}
        </div>
      </Card>

      <Card
        sectionLabel="Map Pack Keyword Breakdown"
        right={
          <span className="cell-muted" style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 6 }}>
            {d.core_offering ? `Core offering: "${d.core_offering}"` : "Branded keywords — no Core Offering supplied"}
            <Tip text="Each keyword tested against Google's local 3-pack, and whether — and where — this business appeared." />
          </span>
        }
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
        {reviews?.rating_distribution && (
          <div style={{ marginBottom: 20 }}>
            <p className="section-label" style={{ marginBottom: 8 }}>
              Rating Distribution
              <Tip text="Star ratings across the reviews this API call actually returned — see reviews_sampled below, this isn't necessarily the listing's entire review history." />
            </p>
            <DistributionBar
              segments={[5, 4, 3, 2, 1].map((star) => ({
                label: `${star}★`,
                value: reviews.rating_distribution?.[String(star)] ?? 0,
                color: star >= 4 ? "var(--accent)" : star === 3 ? "var(--accent-amber)" : "var(--accent-red)",
              }))}
            />
            {reviews.reviews_sampled != null && (
              <p className="note-text">Based on the {fmtInt(reviews.reviews_sampled)} most recent reviews returned by the API.</p>
            )}
          </div>
        )}
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
