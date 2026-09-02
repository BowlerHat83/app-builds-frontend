import pathlib

path = pathlib.Path.home() / "app-builds-frontend" / "src" / "components" / "layout" / "InputGuideModal.tsx"
text = path.read_text(encoding="utf-8")

edits = [
    (
        'const GUIDE_URL = "https://claude.ai/code/artifact/a44ebc13-dbf3-44e4-a3a1-18922669bd53";',
        'const GUIDE_URL = "https://claude.ai/code/artifact/1fd34a08-2daf-4cf0-8f52-8c97e3ac094c";',
    ),
    (
        '{ slot: "ai_facts_csv", tool: "Waikay", export: "Fact Tracker export (Brand Name report)", feeds: "T4", match: \'"facts"\' },',
        '{ slot: "ai_facts_csv", tool: "Waikay", export: "Fact Tracker export (Core Offering report)", feeds: "T4", match: \'"facts"\' },',
    ),
]

for old, new in edits:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly 1 match for:\n{old}\nFound {count}. Aborting - file may have changed.")
    text = text.replace(old, new)

path.write_text(text, encoding="utf-8")
print(f"Patched {path} (2 edits applied).")
