import { useState } from "react";
import type { Envelope, Topic7Data, ThinContentPage } from "../types/audit";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Tip from "../components/ui/Tip";
import DataTable, { Column } from "../components/ui/DataTable";
import { fmtInt, fmtPercent, truncate } from "../lib/format";
import { resolveAssetUrl } from "../api/client";
import ZoomableImage from "../components/ui/ZoomableImage";

export default function Topic7Content({ envelope }: { envelope: Envelope<Topic7Data> }) {
  const d = envelope.data;
  const thin = d.thin_content_analysis;
  const forms = d.form_detection;
  const visuals = d.form_visual_breakdowns ?? [];
  const [expanded, setExpanded] = useState(false);

  const avgInputsPerForm =
    forms && forms.unique_forms.length
      ? forms.unique_forms.reduce((sum, f) => sum + f.total_inputs, 0) / forms.unique_forms.length
      : null;

  const thinColumns: Column<ThinContentPage>[] = [
    { key: "url", header: "URL", render: (r) => <span className="cell-mono">{truncate(r.url, 60)}</span> },
    { key: "words", header: "Words", align: "right", render: (r) => fmtInt(r.word_count) },
    { key: "chars", header: "Characters", align: "right", render: (r) => fmtInt(r.character_count) },
    { key: "thin", header: "Status", align: "right", render: () => <Badge tone="warn">Thin</Badge> },
  ];

  // Only the thin-content URLs are worth showing here — anything not listed
  // is fine (word/character count above the thin threshold), per the actual
  // thin_content_page_count/percentage stats above the table.
  const rows = (thin?.page_details ?? []).filter((r) => r.is_thin);
  const visibleRows = expanded ? rows : rows.slice(0, 8);

  return (
    <div className="stack">
      {envelope.warnings.length > 0 && <div className="status-banner warn">{envelope.warnings.join(" · ")}</div>}

      <div className="grid grid-4">
        <div className="stat-card">
          <span className="stat-card-label">
            No. of Unique Forms
            <Tip text="Distinct forms found across the crawled pages, deduplicated by their input fields — the same footer contact form on every page only counts once." />
          </span>
          <span className="stat-card-value">{fmtInt(forms?.unique_forms_count)}</span>
          <span className="stat-card-sub">{fmtInt(forms?.total_forms_found)} total form instances found</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Avg Inputs per Form
            <Tip text="Average number of input fields (text, select, textarea, etc) per unique form — a rough proxy for how much friction each form asks of a visitor. Hidden inputs (CSRF tokens, tracking params) are excluded, since a real visitor never sees or fills those in." />
          </span>
          <span className="stat-card-value">{avgInputsPerForm != null ? avgInputsPerForm.toFixed(1) : "–"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Avg CTAs per Page
            <Tip text="Average number of call-to-action buttons/links (book, contact, get a quote, sign up, etc) found per crawled page." />
          </span>
          <span className="stat-card-value">{forms?.avg_ctas_per_page != null ? forms.avg_ctas_per_page.toFixed(1) : "–"}</span>
          {forms?.total_ctas_found != null && (
            <span className="stat-card-sub">{fmtInt(forms.total_ctas_found)} total CTAs across {fmtInt(forms.pages_checked_count)} pages checked</span>
          )}
        </div>
        <div className="stat-card">
          <span className="stat-card-label">
            Thin Content URLs
            <Tip text="Pages whose word/character count falls below a healthy threshold for genuinely useful content — thin pages tend to rank and convert poorly." />
          </span>
          <span className="stat-card-value">{fmtInt(thin?.thin_content_page_count)}</span>
          <span className="stat-card-sub">{thin ? fmtPercent(thin.thin_content_percentage, 1) : "–"} of {fmtInt(thin?.total_pages_analyzed)} pages analyzed</span>
        </div>
      </div>

      <Card
        sectionLabel="Thin Content URLs"
        right={
          rows.length > 8 && (
            <button className="link-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Collapse" : `Expand table (${rows.length})`}
            </button>
          )
        }
      >
        <DataTable columns={thinColumns} rows={visibleRows} emptyMessage="No thin-content pages found" maxHeight={expanded ? 480 : undefined} />
      </Card>

      <Card sectionLabel="Forms Detected">
        {forms?.note && <p className="note-text" style={{ marginTop: -6, marginBottom: 16 }}>{forms.note}</p>}
        {forms && forms.unique_forms.length > 0 ? (
          <div className="grid grid-2">
            {forms.unique_forms.map((f) => {
              const visual = visuals.find((v) => v.form_id === f.form_id);
              const shotUrl = resolveAssetUrl(visual?.relative_path);
              return (
                <div key={f.form_id} className="form-card">
                  <div className="form-card-shot">
                    {shotUrl && visual?.status === "captured" ? (
                      <ZoomableImage src={shotUrl} alt={`Form ${f.form_id} screenshot`} />
                    ) : (
                      <span className="placeholder">
                        {visual?.status === "hidden_on_load"
                          ? "Form hidden on load (popup/modal) — no screenshot"
                          : visual?.note ?? "No screenshot captured"}
                      </span>
                    )}
                  </div>
                  <div className="form-card-body">
                    <span className="form-card-url">{f.first_seen_url}</span>
                    <div className="form-card-row">
                      <span>Number of Inputs</span>
                      <b>{f.total_inputs}</b>
                    </div>
                    <div className="form-card-row">
                      <span>No. of URLs it appears on</span>
                      <b>{f.occurrence_count}</b>
                    </div>
                    {visual && (
                      <div className="form-card-row">
                        <span>Mandatory / Voluntary</span>
                        <b>
                          {visual.mandatory_inputs} / {visual.voluntary_inputs}
                        </b>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="chart-empty">No forms detected</div>
        )}
      </Card>
    </div>
  );
}
