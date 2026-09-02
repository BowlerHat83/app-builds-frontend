import pathlib

path = pathlib.Path.home() / "app-builds-frontend" / "src" / "components" / "layout" / "InputGuideModal.tsx"
text = path.read_text(encoding="utf-8")

old = '{ slot: "ai_facts_csv", tool: "Waikay", export: "Fact Tracker export (Brand Name report)", feeds: "T4", match: \'"facts"\' },'
new = '{ slot: "ai_facts_csv", tool: "Waikay", export: "Fact Tracker export (Core Offering report)", feeds: "T4", match: \'"facts"\' },'

count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly 1 match, found {count}. Aborting - file may have changed.")

path.write_text(text.replace(old, new), encoding="utf-8")
print(f"Patched {path} ({count} match replaced).")
