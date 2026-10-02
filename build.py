"""Bundle the help site into one self-contained HTML file.

Reads src/ (index.html, styles.css, app.js, images/) and writes
dist/B2W-API-Help-Guide.html with the CSS, JS, and every image inlined, so the
result can be shared as a single file. Standard library only.

    python build.py
"""
import base64
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT / "dist" / "B2W-API-Help-Guide.html"

mimetypes.add_type("image/webp", ".webp")


def data_uri(rel_path: str) -> str:
    path = SRC / rel_path
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def main() -> None:
    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    js = (SRC / "app.js").read_text(encoding="utf-8").replace("</script", "<\\/script")

    used = set()

    def swap(match: re.Match) -> str:
        attr, rel = match.group(1), match.group(2)
        used.add(rel)
        return f'{attr}="{data_uri(rel)}"'

    html = re.sub(r'(src|href)="(images/[^"]+)"', swap, html)

    # Check the markup (before the script is inlined) for any other local file references.
    leftovers = set(re.findall(r'(?:src|href)="(?!https?:|data:|#|mailto:)([^"]+)"', html)) - {"styles.css", "app.js"}
    if leftovers:
        raise SystemExit(f"Unresolved local references: {sorted(leftovers)}")

    html = html.replace('<link rel="stylesheet" href="styles.css">', f"<style>\n{css}\n</style>")
    html = html.replace('<script src="app.js"></script>', f"<script>\n{js}\n</script>")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"Inlined {len(used)} images -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:,.0f} KB)")


if __name__ == "__main__":
    main()
