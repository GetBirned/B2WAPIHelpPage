# B2W API Help Guide

A help guide for the B2W Support Team covering the B2W cloud APIs. The header switch moves between three APIs, each with its own color scheme:

| API | Status | Color |
|---|---|---|
| Ops API | Complete guide | Trimble Blue |
| Estimate API | Coming soon | Green |
| Management Reporting API | Coming soon | Violet |

The Ops API guide answers questions such as "How do I generate a Bearer Token?" and "How do I find my clientID and clientSecret?" with step-by-step walkthroughs, annotated screenshots, Postman, PowerShell, and cURL examples, a ticket troubleshooter, an endpoint explorer, and a knowledge check. Examples use the **B2WTechSupport** environment.

## Use it

Open `dist/B2W-API-Help-Guide.html` in any browser. It is one self-contained file (styles, scripts, and screenshots are embedded), so it can be shared as-is. `dist/B2W-API-Help-Guide.pdf` is the printable version of the Ops API guide.

Links that open a specific guide directly:

- `B2W-API-Help-Guide.html#estimate-api`
- `B2W-API-Help-Guide.html#reporting-api`
- Any Ops API question, for example `B2W-API-Help-Guide.html#bearer-token`

## Edit it

```
src/
  index.html     page content; each API is a <div class="product-view" data-view="ops|est|mr">
  styles.css     design tokens at the top, including the per-API color schemes
  app.js         switcher, search, tabs, troubleshooter, endpoint explorer, quiz
  images/        redacted, annotated screenshots (WebP) and logo marks
build.py         bundles src/ into dist/B2W-API-Help-Guide.html
tools/
  export-pdf.js  prints dist/ to PDF with headless Chrome or Edge
source-material/ (not in git) original notes, slides, and raw screenshots
```

After editing anything in `src/`:

```
python build.py
node tools/export-pdf.js
```

`build.py` needs Python 3.8+ and nothing else. `export-pdf.js` needs Node 22+ and Chrome or Edge (set `CHROME_PATH` if the browser is somewhere unusual).

To preview while editing, open `src/index.html` directly, or serve `dist/` with `python -m http.server 8765 --directory dist` and visit http://localhost:8765/B2W-API-Help-Guide.html.

### Adding the Estimate or Management Reporting guide

Replace the coming-soon content inside `data-view="est"` or `data-view="mr"` in `src/index.html`, using the Ops API sections as the pattern. Then remove the `Soon` tag from that API's button in the header switch and update its status in the "API guides" lists.

## Screenshots and secrets

Every screenshot in `src/images/` has tokens, secrets, TID IDs, and client IDs masked. The originals in `source-material/` do not, which is why that folder is ignored by git. Do not commit raw screenshots, and check any new screenshot for credentials before adding it.
