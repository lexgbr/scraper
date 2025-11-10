# SVP Scraper Demo

Multi-site Playwright scraper with a Next.js UI for managing product lists, credentials, and run history. Currently supports:

| Site             | Id             | Notes                                                                 |
|------------------|----------------|-----------------------------------------------------------------------|
| Romprod          | `romprod`      | Direct product URLs with unit price selector                         |
| Mastersale       | `mastersale`   | Direct URLs, standard price selector                                 |
| Maxy Wholesale   | `maxywholesale`| Search-based flow + unit/box toggle to capture both prices           |
| Romega Foods     | `romegafoods`  | Only publishes box price; unit price is derived from pack size text  |
| Foodex London    | `foodex`       | Similar to Romega; supports pack info ribbon and selector            |


## Project Layout

```
.
├── apps/web                 # Next.js demo UI (dashboard, products, price lists, settings)
├── packages/db              # Prisma schema + migrations
├── src                      # Scraper runtime (runner, adapters, Playwright helpers)
├── data                     # Generated products.json (input for runner)
└── .state                   # Stored Playwright authentication states + creds.json
```


## Prerequisites

- Node.js 20+ (repo currently runs on Node 22)
- npm 10+ (11 recommended)
- Playwright browsers (installed automatically via `npm install`)


## 1. Install dependencies

```bash
# root (scraper runtime)
npm install

# Next.js UI
cd apps/web
npm install
```

The root `npm install` triggers the Prisma generate step and installs Playwright browsers.


## 2. Database

SQLite lives in `packages/data/demo.db`. To recreate/migrate:

```bash
cd packages/db
npx prisma migrate dev --name init    # or the latest migration file
```

> The `ensureSeed()` helper (called by `/api/home`) inserts Romprod + one sample product if the DB is empty.


## 3. Environment variables

### Scraper/runtime (`.env` at repo root)

```ini
# Credentials per site
ROMPROD_USERNAME=...
ROMPROD_PASSWORD=...
ROMPROD_TOTP_SECRET=

MASTERSALE_USERNAME=...
MASTERSALE_PASSWORD=...

MAXYWHOLESALE_USERNAME=...
MAXYWHOLESALE_PASSWORD=...

ROMEGAFOODS_USERNAME=...
ROMEGAFOODS_PASSWORD=...

FOODEX_USERNAME=...
FOODEX_PASSWORD=...

# Optional: restrict runs to one site without CLI flag
SCRAPER_SITE=
# Optional: tweak login concurrency (kept at 1 to avoid OTP issues)
SCRAPER_CONCURRENCY=1
```

Authentication data saved via the UI ends up in `.state/creds.json`. Playwright storage state per site is written to `.state/<siteId>.json`.

### Next.js UI (`apps/web/.env.local`)

```
SELF_BASE_URL=http://localhost:3000
```

Set this when running the UI behind a tunnel or non-default port so `/api/run` can call itself correctly.


## 4. Running the demo UI

```bash
cd apps/web
npm run dev      # listens on http://localhost:3000
```

Key pages:

- `/` – dashboard (status tiles, change feed, per-site cards, run button)
- `/products` – add/remove products per site, inline confirmation modal
- `/settings` – manage credentials per site (user/password/TOTP)


## 5. Using the scraper

The runner reads `data/products.json`. `/api/run` regenerates this file automatically from the DB, but you can also run the scraper standalone from the CLI.

### Populate products via UI

1. Go to `/products`.
2. Pick an existing product (or type a new name) in the “Add / update product links” form.
3. Paste the site-specific URLs in the rows provided—leave blank for sites that don’t stock the item.
4. Click **Save links** to create/update every marketplace entry in one go. You can revisit the form later to add more sites for the same product.
5. For catalogue-only stores (e.g. Maxy Wholesale), simply enable the site and optionally override the search query—the scraper will search by product name if you leave it blank.
6. Expand any product in the list to review or remove individual site links.
7. Visit `/pricelists` any time to see the latest scraped prices grouped by site.
8. Once you move past the default sample data, set `SEED_DEMO=false` in `.env` (and restart the servers) so the demo Romprod product isn’t re-created after deletions.

### Trigger from the UI

Open `/` and click **Run scraper**. The API will:

1. Call `/api/products`, write `data/products.json`.
2. Spawn `node src/runner.ts`.
3. Stream JSON lines, updating `ProductLink`, `PriceSnapshot`, `PriceChange`, and `QueryRun`.

### CLI (single site testing)

```bash
# Run every site in products.json
npm run scrape

# Only Romprod
npm run scrape -- --site romprod

# Reads SCRAPER_SITE if no flag is provided
SCRAPER_SITE=foodex npm run scrape
```

Output is newline-delimited JSON, one record per product. Errors are emitted on stderr as `{"type":"scrape-error", ...}`.


## 6. Multi-price data

Each scrape now records:

- `amount` — last unit price (or derived per-unit)
- `packPrice`, `packSize`, `packLabel`
- `unitLabel`

These fields flow through to:

- `ProductLink` (`lastPriceUnit`, `lastPricePack`, etc.)
- `PriceSnapshot` table
- `/api/products` response, surfaced on `/products` page

If a site only exposes box price (e.g., Romega Foods), the adapter derives unit price using the “12 x 80g” ribbon. Maxy Wholesale searches by name, opens the matching card, and toggles the unit/box dropdown you highlighted to capture both values directly.


## Troubleshooting

- **Login failures** – check `.state/<site>.json` and `.state/creds.json`. Regenerate by updating credentials and re-running.
- **Playwright timeouts** – selectors live in `config/sites.ts` and per-product overrides. Adjust there or edit the specific adapter.
- **Database locked** – stop any running `npm run dev` instance before running CLI migrations.
- **SCRAPER_SITE ignored** – ensure you don’t pass positional args; `npm run scrape romprod` treats `romprod` as `--` value. Use `npm run scrape -- --site romprod`.

Feel free to extend `config/sites.ts` with new marketplaces; register a new adapter in `src/adapters`, add it to the `adapters` map inside `src/runner.ts`, and the UI will pick it up automatically.
