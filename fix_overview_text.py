import pathlib

path = pathlib.Path.home() / "app-builds-frontend" / "src" / "pages" / "OverviewTab.tsx"
text = path.read_text(encoding="utf-8")

old = '''        <p className="note-text">
          {audit.complete !== false ? (
            <>
              The composite grade/score above is calculated in the browser: it's a plain average of every topic's
              score (0–100, Topic 5's reflecting data completeness rather than a good/bad direction — see its tab)
              that actually has real data behind it. A topic with no data at all is N/A, not a 0 — it's dropped
              from both the total and the count of topics averaged, so a missing input never drags the composite
              down, and that topic starts counting again the moment real data is supplied for it. It isn't a
              number the API returns directly.
            </>
          ) : (
            "Composite grade/score will show once every topic has finished — showing it mid-run would misread partially-loaded topics as final results."
          )}
        </p>
        {audit.complete !== false ? ('''

new = '''        {audit.complete !== false ? ('''

count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly 1 match, found {count}. Aborting - file may have changed.")

path.write_text(text.replace(old, new), encoding="utf-8")
print(f"Patched {path} ({count} match replaced).")
