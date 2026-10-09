"""Build the help site into dist/.

Reads src/ (index.html, styles.css, fields.js, app.js, images/, downloads/) and writes:

    dist/index.html                 the guide, served at https://www.b2w-api.com/
    dist/B2W-API-Help-Guide.html    the same page, under a name that reads well as a shared file
    dist/downloads/*.json           the Postman collections the guide's buttons download
    dist/og-image.png               the picture shown when someone shares a link to the site
    dist/robots.txt                 tells search engines what not to crawl

The page has its CSS, JS, and every image inlined, so it also works as a single file opened from
disk (the download buttons need dist/downloads next to it). Standard library only.

    python build.py
"""
import base64
import mimetypes
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
OUT = DIST / "B2W-API-Help-Guide.html"
INDEX = DIST / "index.html"
DOWNLOADS = "downloads"
OG_IMAGE = ROOT / "brand" / "api-logo-ops-1000.png"

mimetypes.add_type("image/webp", ".webp")


def data_uri(rel_path: str) -> str:
    path = SRC / rel_path
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def main() -> None:
    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    js = (SRC / "app.js").read_text(encoding="utf-8").replace("</script", "<\\/script")
    fields = (SRC / "fields.js").read_text(encoding="utf-8").replace("</script", "<\\/script")

    used = set()

    def swap(match: re.Match) -> str:
        attr, rel = match.group(1), match.group(2)
        used.add(rel)
        return f'{attr}="{data_uri(rel)}"'

    html = re.sub(r'(src|href|data-icon-\w+)="(images/[^"]+)"', swap, html)

    # Check the markup (before the script is inlined) for any other local file references.
    refs = set(re.findall(r'(?:src|href)="(?!https?:|data:|#|mailto:|tel:)([^"]+)"', html)) - {"styles.css", "fields.js", "app.js"}
    downloads = {r for r in refs if r.startswith(DOWNLOADS + "/")}
    leftovers = refs - downloads
    if leftovers:
        raise SystemExit(f"Unresolved local references: {sorted(leftovers)}")
    missing = sorted(d for d in downloads if not (SRC / d).exists())
    if missing:
        raise SystemExit(f"Download buttons point at files that aren't in src/: {missing}")

    html = html.replace('<link rel="stylesheet" href="styles.css">', f"<style>\n{css}\n</style>")
    html = html.replace('<script src="fields.js"></script>', f"<script>\n{fields}\n</script>")
    html = html.replace('<script src="app.js"></script>', f"<script>\n{js}\n</script>")

    DIST.mkdir(exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    INDEX.write_text(html, encoding="utf-8")

    # Downloads: replace the folder so a removed collection doesn't linger on the site.
    shutil.rmtree(DIST / DOWNLOADS, ignore_errors=True)
    (DIST / DOWNLOADS).mkdir()
    for d in sorted(downloads):
        shutil.copy2(SRC / d, DIST / d)
    shutil.copy2(SRC / "robots.txt", DIST / "robots.txt")
    if OG_IMAGE.exists():
        shutil.copy2(OG_IMAGE, DIST / "og-image.png")

    print(f"Inlined {len(used)} images -> {OUT.relative_to(ROOT)} and {INDEX.relative_to(ROOT)} ({OUT.stat().st_size / 1024:,.0f} KB each)")
    print(f"Copied {len(downloads)} downloads -> {DOWNLOADS}/: " + ", ".join(Path(d).name for d in sorted(downloads)))


if __name__ == "__main__":
    main()
