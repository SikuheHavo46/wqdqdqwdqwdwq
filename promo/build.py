"""Inline the Geist subsets and motion.js into src.html -> index.html (single self-contained file)."""
import base64, pathlib

root = pathlib.Path(__file__).parent
html = (root / "src.html").read_text(encoding="utf-8")
for key, name in (("__FONT_LATIN__", "latin"), ("__FONT_CYR__", "cyrillic")):
    html = html.replace(key, base64.b64encode((root / "fonts" / f"inter-{name}.woff2").read_bytes()).decode())
html = html.replace('<script src="__SCRIPT__"></script>', "<script>\n" + (root / "motion.js").read_text(encoding="utf-8") + "</script>")
(root / "index.html").write_text(html, encoding="utf-8")
print("index.html", len(html) // 1024, "KB")
