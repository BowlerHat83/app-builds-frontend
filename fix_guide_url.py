import pathlib

path = pathlib.Path.home() / "app-builds-frontend" / "src" / "components" / "layout" / "InputGuideModal.tsx"
text = path.read_text(encoding="utf-8")

old = 'const GUIDE_URL = "https://claude.ai/code/artifact/a44ebc13-dbf3-44e4-a3a1-18922669bd53";'
new = 'const GUIDE_URL = "https://claude.ai/code/artifact/1fd34a08-2daf-4cf0-8f52-8c97e3ac094c";'

count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly 1 match, found {count}. Aborting - file may have changed.")

path.write_text(text.replace(old, new), encoding="utf-8")
print(f"Patched {path} ({count} match replaced).")
