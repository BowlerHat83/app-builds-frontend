import pathlib

path = pathlib.Path.home() / "app-builds-frontend" / "src" / "pages" / "Topic4AIVisibility.tsx"
text = path.read_text(encoding="utf-8")

old_vars = '''  const factsOverview = d.facts_overview;
  const statusEntries = factsOverview?.status_breakdown
    ? Object.entries(factsOverview.status_breakdown).sort((a, b) => b[1] - a[1])
    : [];
  const dateRange = factsOverview?.date_range;
  return ('''

new_vars = '''  return ('''

old_card = '''      {factsOverview && (statusEntries.length > 0 || dateRange) && (
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
      <div className="two-col">'''

new_card = '''      <div className="two-col">'''

for old, new, name in [(old_vars, new_vars, "variable declarations"), (old_card, new_card, "Facts Data Overview card")]:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly 1 match for {name}, found {count}. Aborting - file may have changed.")
    text = text.replace(old, new)

path.write_text(text, encoding="utf-8")
print("Patched Topic4AIVisibility.tsx (2 edits applied).")
