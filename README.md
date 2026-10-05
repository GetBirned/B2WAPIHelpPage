# B2W API Help Guide

A help guide for the B2W Support Team covering the three B2W cloud APIs. The switch in the header moves between them, and each has its own color scheme:

| API | Address prefix | Color | Guide |
|---|---|---|---|
| Ops API | `OpsAPI_` | Trimble Blue | 21 questions plus reference sections (security, FAQ, quiz, cheat sheet, glossary) |
| Estimate API | `EstAPI_` | Green | 11 questions |
| Management Reporting API | `MRAPI_` | Violet | 10 questions |

Each guide answers questions such as "How do I generate a Bearer Token?" with step-by-step walkthroughs, annotated screenshots, and Postman, PowerShell, cURL, and raw HTTP examples. Examples use the **B2WTechSupport** environment.

### Environment checker

Paste a customer's Ops address (for example `https://b2w-eus10.b2w.trimble.com/B2WTechSupport`) and the checker builds copyable addresses for all three APIs, then sends a sample `GET /Ping/hello` to each and reports **Up**, **Not found** (wrong environment name), or **No response** (site, IIS, or network down). It is in each guide's "find the URL" question and in the header (the signal icon).

Browsers can't read replies from another site, and these APIs send no CORS headers, so the checker pairs the ping with a load of each API's Swagger icon (`/doc/favicon-16x16.png`), which only succeeds when that API is serving the environment. It also generates a PowerShell command that shows the raw replies.

### Error decoder

Paste anything a customer sends (a status line, a JSON or XML error body, a Postman or PowerShell error, request headers, or the request URL) and the decoder works out the API, status code, call, endpoint, and environment, then names the likely cause and links to the fix. It knows each API's own messages (for example the Ops 403 `InternalMessage` that names the missing privilege, `ApiEmployee.Read`, and the Estimate/MR "The user is not authorized for this API."), SQL Server login errors, IIS and network failures, and checks pasted paths against the endpoint catalogs and pasted headers for a missing `Bearer`, `DatabaseName`, or `EstimateREF`. Results include a one-click environment check and a plain-text summary to paste into the ticket.

It is the "What does this error mean?" question in each guide's troubleshooting part and in the header (the `{!}` icon). Decoding runs entirely in the browser: nothing pasted is sent or stored. Rules live in `app.js` (`DEC_RULES`).

### Request builder

Pick an environment (paste the customer's Ops address), an API, a login method, and an endpoint, then add OData options, `DatabaseName`, `EstimateREF`, an `ObjectID`, or a JSON body as the call needs. The builder writes the same request, login step included, for Postman (which variables and headers to set), PowerShell, cURL, and raw HTTP. It only offers the methods each endpoint supports, flags endpoint names that aren't in the catalog, and warns before POST, PUT, and DELETE. Credentials always stay placeholders, so no secret is typed into the page. It opens from the **Request builder** button in the top bar, next to the API switch, and follows the guide you're reading until you edit it. Every endpoint in the explorers also has a **Build** button that opens the builder with that endpoint loaded.

The builder's **filter helper** writes `$filter` from conditions: pick a field from the endpoint's own field list, a condition, and a value. It quotes text (doubling any apostrophe), leaves IDs unquoted, writes dates the way each API's docs do (`2021-01-01` for Estimate, `2024-01-01T00:00:00Z` for Ops and MR), compares dates by whole day, and checks numbers and IDs as you type. Each guide's filtering question links to it.

### Token inspector

Paste an AccessToken, an `Authorization: Bearer` header, or a whole login response, and the inspector decodes the JWT: when it was issued and expires, its lifetime (Ops defaults to 1 day), who it belongs to, its issuer and audience, and every claim inside. It explains what that means for a 401 (expired, not valid yet, still valid so look elsewhere, or a Trimble ID token that belongs on `/LoginWithTID`), and can check the token against the time a call failed. It finds every token in pasted text, flags tokens that were cut off when copied, and copies findings for the ticket without the token. Decoding happens on the page only; the token is cleared when the dialog closes, and the signature isn't checked (that needs the server's key).

It opens from the key icon in the top bar, from each guide's login section, and from the error decoder, which offers **Inspect the token** when pasted text contains one.

### Logo

The API hexagon logo is built from the B2W logo: the same hexagon, two-tone shading, and inner outline, with "API" drawn from the B2W lettering's measured strokes. It comes in each guide's color: Trimble Blue for Ops (the default), green for Estimate, and violet for Management Reporting. On the page it is one inline SVG symbol whose colors follow the API switch (`--logo-*` variables in `styles.css`); the top bar adds a light edge so the hexagon stays visible on a header of the same color. The browser tab icon switches with the guide too.

`brand/` holds the files for use elsewhere: `api-logo-{ops,est,mr}.svg` and 1000 px / 500 px transparent PNGs, compact `api-icon-*.svg` marks for small sizes, the classic red version (`api-logo-red.*`), and `logo-versions.png`, an overview.

## Use it

Open `dist/B2W-API-Help-Guide.html` in any browser. It is one self-contained file (styles, scripts, and screenshots are embedded), so it can be shared as-is. Printable versions:

- `dist/B2W-Ops-API-Guide.pdf`
- `dist/B2W-Estimate-API-Guide.pdf`
- `dist/B2W-Management-Reporting-API-Guide.pdf`

Links that open a specific guide or question directly:

- `B2W-API-Help-Guide.html#estimate-api` and `#reporting-api`
- Any question: `#bearer-token` (Ops), `#est-login` (Estimate), `#mr-headers` (Management Reporting)

## Host it

The repo deploys to Railway as-is. The `Staticfile` in the root tells Railpack to serve `dist/` as a static site (with Caddy), and `dist/index.html` forwards the site root to the guide, keeping any `#question` link. There is no build step on Railway: `dist/` is committed, so run `python build.py` and commit before deploying a change.

Railway gives the service a public URL, so anyone with the link can open the guide.

## Edit it

```
src/
  index.html     page content; each API is a <div class="product-view" data-view="ops|est|mr">,
                 and each has its own sidebar list in <div class="toc-product" data-for="…">
  styles.css     design tokens at the top, including the per-API color schemes
  fields.js      generated field lists for the $filter helper (see below)
  app.js         switcher, search, tabs, environment checker, error decoder, request builder, token inspector,
                 endpoint explorers, troubleshooter, quiz
  images/        redacted, annotated screenshots (WebP) and the per-guide tab icons
build.py         bundles src/ into dist/B2W-API-Help-Guide.html (plus dist/index.html for hosting)
Staticfile       tells Railway's Railpack to serve dist/ as a static site
tools/
  export-pdf.js  prints each guide to its own PDF with headless Chrome or Edge
  sync-fields.js rebuilds src/fields.js from each API's published OpenAPI document
brand/           the API logo in each guide's color (SVG and PNG)
source-material/ (not in git) original notes, slides, and raw screenshots
```

After editing anything in `src/`:

```
python build.py
node tools/export-pdf.js
```

`build.py` needs Python 3.8+ and nothing else. `export-pdf.js` needs Node 22+ and Chrome or Edge (set `CHROME_PATH` if the browser is somewhere unusual).

To preview while editing, open `src/index.html` directly, or serve `dist/` with `python -m http.server 8765 --directory dist` and visit http://localhost:8765/B2W-API-Help-Guide.html.

Question IDs in the Estimate guide start with `est-` and in the Management Reporting guide with `mr-`; the page uses those prefixes to open the right guide from a link. Endpoint lists for the explorers live in `app.js` (`OPS_EP`, `EST_EP`, `MR_EP`).

The `$filter` helper's field lists come from the B2WTechSupport OpenAPI documents. After a B2W release, refresh them with `node tools/sync-fields.js` (it needs network access to b2w-eus10.b2w.trimble.com), then run `python build.py`.

## Sources

- **Ops API:** the Ops API Support Training (slides and walkthrough notes) and the B2WTechSupport API catalog.
- **Estimate and Management Reporting APIs:** their B2WTechSupport API documentation (`/doc/index.html`, `/doc/v1/EstAPI.json`, `/doc/v2/MRAPI.json`) and the official Postman collections linked from it.
- Live responses (ping, login errors, version) were checked against B2WTechSupport on October 2, 2026.

## Screenshots and secrets

Every screenshot in `src/images/` has tokens, secrets, TID IDs, and client IDs masked. The originals in `source-material/` do not, which is why that folder is ignored by git. Do not commit raw screenshots, and check any new screenshot for credentials before adding it.
