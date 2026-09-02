import pathlib

path = pathlib.Path.home() / "app-builds-frontend" / "src" / "pages" / "Topic1Accessibility.tsx"
text = path.read_text(encoding="utf-8")

old = '''            {wcagCounts!.critical + wcagCounts!.serious + wcagCounts!.moderate + wcagCounts!.minor === 0 ? (
              <p className="note-text">No accessibility issues detected at any severity.</p>
            ) : ('''

new = '''            {wcagCounts!.critical + wcagCounts!.serious + wcagCounts!.moderate + wcagCounts!.minor === 0 ? (
              <DistributionBar
                segments={[{ label: "No issues", value: 1, color: "var(--accent-green, #22c55e)" }]}
              />
            ) : ('''

count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly 1 match, found {count}. Aborting - file may have changed.")

path.write_text(text.replace(old, new), encoding="utf-8")
print(f"Patched {path} ({count} match replaced).")
