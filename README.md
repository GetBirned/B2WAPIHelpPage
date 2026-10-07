# B2W API Help Guide

The guide and case solver at **https://b2w-api.com** for the three B2W cloud APIs, used by customers, partners, and B2W Support alike. The switch in the header moves between them, and each has its own color scheme:

| API | Address prefix | Color | Guide |
|---|---|---|---|
| Ops API | `OpsAPI_` | Trimble Blue | 21 questions plus reference sections (security, FAQ, cheat sheet, glossary, links) |
| Estimate API | `EstAPI_` | Green | 11 questions |
| Management Reporting API | `MRAPI_` | Violet | 10 questions |

Each guide answers questions such as "How do I generate a Bearer Token?" with step-by-step walkthroughs, annotated screenshots, and Postman, PowerShell, cURL, and raw HTTP examples. Examples fill in with the Ops URL you paste.

### Environment checker

Paste a customer's Ops address (for example `https://<cluster>.b2w.trimble.com/TheirSite`) and the checker builds copyable addresses for all three APIs, then sends a sample `GET /Ping/hello` to each and reports **Up**, **Not found** (wrong environment name), or **No response** (site, IIS, or network down). It is in each guide's "find the URL" question and in the header (the signal icon).

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

### Ops URL and examples

The guide never shows a real environment address. On first open, each guide's intro card just says **Paste your Ops URL**, and every example reads `https://<cluster>.b2w.trimble.com/OpsAPI_<environment>`. Paste an Ops URL into that card (or into the environment checker or the request builder) and every example address, link, copy button, and tool in all three guides fills in with it, along with the Ops, Estimate, and MR API addresses built from it. A notice at the top of the page shows which environment is in use, with **Clear** to go back to the placeholders. Links that still hold placeholders ask for the Ops URL instead of opening.

The choice is remembered in your browser. **Copy a link with this environment** gives a link like `…/B2W-API-Help-Guide.html?env=https%3A%2F%2F<cluster>.b2w.trimble.com%2FTheirSite`, which opens the guide already filled in.

Keep it that way when editing: write example addresses with the `<cluster>.b2w.trimble.com` and `<environment>` placeholders (`&lt;cluster&gt;` and `&lt;environment&gt;` in `index.html`), refer to the support team's own environment as "our test environment", and blur any address that shows up in a new screenshot. Internal-only tools aren't mentioned or shown.

### Postman collections and support contact

Each guide's **Download the … collection** button (and the header's **Collection** link) downloads that API's Postman collection as a JSON file from `downloads/`. Every collection goes through `tools/clean-collection.js` first, which strips the exporting Postman account's ID, blanks credential variables, resets any real server address to a placeholder, drops saved responses, and refuses to write the file if a token or a real B2W address is still inside:

```
node tools/clean-collection.js "source-material/B2W Ops API.postman_collection.json" src/downloads/B2W-Ops-API.postman_collection.json
```

Keep raw exports in `source-material/` (ignored by git); only the cleaned copies in `src/downloads/` are committed and published.

B2W Support is support_b2w@trimble.com and +1 (888) 390-8822. The footer (`#contact`) lists both, every troubleshooting section ends with a "Still stuck? Contact B2W Support" box, and fixes that need B2W's help link there.

## Use it

Open https://b2w-api.com, or `dist/index.html` from disk. The page is self-contained (styles, scripts, and screenshots are embedded); `dist/B2W-API-Help-Guide.html` is the same page under a name that reads well as a shared file, and the download buttons need `dist/downloads/` next to it. Printable versions:

- `dist/B2W-Ops-API-Guide.pdf`
- `dist/B2W-Estimate-API-Guide.pdf`
- `dist/B2W-Management-Reporting-API-Guide.pdf`

Links that open a specific guide or question directly:

- `B2W-API-Help-Guide.html#estimate-api` and `#reporting-api`
- Any question: `#bearer-token` (Ops), `#est-login` (Estimate), `#mr-headers` (Management Reporting)

## Host it

The repo deploys to Railway as-is, at https://www.b2w-api.com (GoDaddy forwards the bare b2w-api.com there, since its DNS can't point the bare domain at Railway). The `Staticfile` in the root tells Railpack to serve `dist/` as a static site (with Caddy): `index.html` is the guide, `downloads/` holds the Postman collections, and `og-image.png` is the picture link previews show. There is no build step on Railway: `dist/` is committed, so run `python build.py` (and `node tools/export-pdf.js` when the content changes) and commit before deploying a change.

The site is public. Before publishing anything, check that it has no environment addresses, internal links, credentials, or personal details (see the sections above and below).

## Edit it

```
src/
  index.html     page content; each API is a <div class="product-view" data-view="ops|est|mr">,
                 and each has its own sidebar list in <div class="toc-product" data-for="…">
  styles.css     design tokens at the top, including the per-API color schemes
  fields.js      generated field lists for the $filter helper (see below)
  app.js         switcher, search, tabs, environment checker, error decoder, request builder, token inspector,
                 endpoint explorers, troubleshooter
  images/        redacted, annotated screenshots (WebP) and the per-guide tab icons
  downloads/     the cleaned Postman collections the guide offers for download
build.py         bundles src/ into dist/B2W-API-Help-Guide.html (plus dist/index.html for hosting)
Staticfile       tells Railway's Railpack to serve dist/ as a static site
tools/
  export-pdf.js  prints each guide to its own PDF with headless Chrome or Edge
  clean-collection.js  cleans a Postman export for src/downloads/
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

The `$filter` helper's field lists come from our test environment's OpenAPI documents (`tools/sync-fields.js` holds its address; it isn't part of the built page). After a B2W release, refresh them with `node tools/sync-fields.js` (it needs network access to our test environment), then run `python build.py`.

## Sources

- **Ops API:** B2W's Ops API training material and our test environment's API catalog.
- **Estimate and Management Reporting APIs:** their API documentation in our test environment (`/doc/index.html`, `/doc/v1/EstAPI.json`, `/doc/v2/MRAPI.json`) and the official Postman collections linked from it.
- Live responses (ping, login errors, version) were checked against our test environment on October 2, 2026.

## Screenshots and secrets

Every screenshot in `src/images/` has tokens, secrets, TID IDs, client IDs, environment addresses, and personal names and emails masked or blurred. The originals in `source-material/` do not, which is why that folder is ignored by git. Do not commit raw screenshots, and check any new screenshot for credentials before adding it.
