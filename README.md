# MarionTrading Scraping Tool

Production-ready Playwright scraper with a Next.js control center for managing product lists, credentials, and run history. Supports:

| Site           | Id             | Notes                                                                 |
|----------------|----------------|-----------------------------------------------------------------------|
| Romprod        | `romprod`      | Direct product URLs with unit price selector                         |
| Mastersale     | `mastersale`   | Direct URLs, standard price selector                                 |
| Maxy Wholesale | `maxywholesale`| Search-based flow + unit/box toggle to capture both prices           |
| Romega Foods   | `romegafoods`  | Only shows box price; adapter derives unit price from pack text      |
| Foodex London  | `foodex`       | Requires manual session; helper extension reuses user browser        |

## Project Layout

```
.
|- apps/web                 # Next.js UI (dashboard, products, price lists, settings, API routes)
|- packages/db              # Prisma schema + migrations
|- src                      # Scraper runtime (runner, adapters, Playwright helpers)
|- data                     # Generated products.json passed to the runner
|- extensions/foodex-helper # Chrome/Chromium helper for the Foodex manual flow
`- .state                   # Stored Playwright storage states + creds.json
```

## Prerequisites

- Node.js 20+ (repo currently runs on Node 22)
- npm 10+ (11 recommended)
- Playwright browsers (installed automatically via `npm install`)

## 1. Install dependencies

```bash
# repo root (scraper runtime)
npm install

# Next.js UI
cd apps/web
npm install
```

`npm install` at the root triggers Prisma generate and downloads the Playwright browser bundles.

## 2. Database

SQLite lives in `packages/data/demo.db` (default file name). To recreate/migrate:

```bash
cd packages/db
npx prisma migrate dev --name init  # or the latest migration file
```

> `ensureSeed()` (called by `/api/home`) inserts Romprod + one sample product if the DB is empty. Set `SEED_DEMO=false` in `.env` once you no longer want that fixture.

## 3. Environment variables

### Scraper/runtime (`.env` at repo root)

```ini
# Credentials per site
ROMPROD_USERNAME=...
ROMPROD_PASSWORD=...
ROMPROD_TOTP_SECRET=

MASTERSALE_USERNAME=...
MASTERSALE_PASSWORD=...

MAXYWHOLESALE_USERNAME=romafoods23@gmail.com
MAXYWHOLESALE_PASSWORD=Dominic23@

ROMEGAFOODS_USERNAME=...
ROMEGAFOODS_PASSWORD=...

FOODEX_USERNAME=...
FOODEX_PASSWORD=...

# Optional:
SCRAPER_SITE=            # restricts runner to one site
SCRAPER_CONCURRENCY=1    # number of simultaneous Playwright logins
```

Credentials saved via the UI are written to `.state/creds.json`. Playwright storage states live in `.state/<siteId>.json` and are reused between runs.

### Next.js UI (`apps/web/.env.local`)

```
SELF_BASE_URL=http://localhost:3000
```

Set this if the UI is exposed via another host or tunnel so `/api/run` can call itself correctly.

## 4. Running the UI

```bash
cd apps/web
npm run dev   # http://localhost:3000
```

Key pages:

- `/` - dashboard (status tiles, change feed, per-site cards, run buttons)
- `/products` - add/remove products per site, inline confirmation modal
- `/settings` - manage credentials per site (user/password/TOTP)
- `/pricelists` - snapshot of the latest scraped price grouped by site

## 5. Using the scraper

The runner reads `data/products.json`. `/api/run` regenerates this file automatically from the DB before spawning the Node process, but you can also run it manually.

### Populate products via UI

1. Go to `/products`.
2. Pick an existing product (or type a new name) in the **Add / update product links** form.
3. Enable each marketplace you care about and paste either the direct product URL or (for catalogue-only sites) the search query.
4. Click **Save links** to create/update every site entry in one go. Revisit anytime to add other marketplaces for the same product.
5. Expand any product row to edit or remove individual site links.
6. `/pricelists` shows the last scraped price for every product/site combination.

### Trigger from the UI

Open `/` and click **Run scraper** (global) or the per-site **Scrape now** buttons. `/api/run` will:

1. Call `/api/products` and write `data/products.json`.
2. Spawn `node src/runner.ts` (filtered to a single site if `siteId` was provided).
3. Stream newline-delimited JSON; each entry updates `ProductLink`, `PriceSnapshot`, `PriceChange`, and `QueryRun` rows.

### CLI (single-site testing)

```bash
# Run every site listed in data/products.json
npm run scrape

# Only Romprod
npm run scrape -- --site romprod

# Respect SCRAPER_SITE environment variable
SCRAPER_SITE=foodex npm run scrape
```

Output is NDJSON. Errors from adapters are logged as `{"type":"scrape-error", ...}` on stderr.

## 6. Foodex manual workflow

Foodex hides behind a Cloudflare human-check, so automation has to reuse your real browser session.

1. Log in to https://foodex.london/login manually (solve the verification) and keep that tab open.
2. On the dashboard, use the Foodex card's **View tutorial** button if you need a refresher.
3. Load the helper found in `extensions/foodex-helper` via `chrome://extensions` and click **Load unpacked** (works in Chrome, Edge, Arc, etc.).
4. Enter your dashboard base URL (e.g., `http://localhost:3000`) and click **Run Foodex Capture**.
5. The helper fetches `GET /api/manual/foodex`, opens each stored product URL in the active tab, reads the configured selector, and finally `POST`s `{ entries: [...] }` back to `/api/manual/foodex`.
6. Refresh `/` or `/pricelists` to see the updated timestamps and price history.

**Manual API reference**

```bash
curl -X POST "$BASE/api/manual/foodex" \
  -H "content-type: application/json" \
  -d '{ "entries": [{ "id": 10, "unitPrice": 12.34, "packPrice": 48.99, "packSize": 4 }] }'
```

The extension popup provides progress updates; once it finishes, the dashboard shows Foodex changes alongside the automated adapters.

## 7. Multi-price data

Each scrape records:

- `amount` - last unit price (or derived per-unit)
- `packPrice`, `packSize`, `packLabel`
- `unitLabel`

These values propagate to:

- `ProductLink` (`lastPriceUnit`, `lastPricePack`, `packSize`, etc.)
- `PriceSnapshot` and `PriceChange` tables
- `/api/products`, `/pricelists`, and the dashboard feed

If a site only exposes box price (e.g., Romega Foods), the adapter derives unit price from ribbons such as 12 x 80g. Maxy Wholesale toggles the unit/box dropdown and captures both values directly.

## Troubleshooting

- **Login failures** - check `.state/<site>.json` and `.state/creds.json`. Update credentials or delete the storage state to re-auth.
- **Playwright timeouts** - adjust selectors in `config/sites.ts` or the specific adapter.
- **Database locked** - stop any running `npm run dev` before applying migrations or CLI scrapes.
- **SCRAPER_SITE ignored** - ensure you pass `-- --site romprod`. `npm run scrape romprod` treats `romprod` as a positional arg.
- **Foodex helper cant reach the dashboard** - confirm the popup base URL matches your deployment and, if necessary, expand the host permissions in `extensions/foodex-helper/manifest.json`.

Extend `config/sites.ts` with new marketplaces, add a corresponding adapter under `src/adapters`, register it in `src/runner.ts`, and the UI will pick it up automatically.

