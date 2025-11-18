import { config as loadEnv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

loadEnv();

(() => {
  const iniPath = path.resolve(process.cwd(), 'env.ini');
  if (!fs.existsSync(iniPath)) return;
  const text = fs.readFileSync(iniPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [rawKey, ...rest] = trimmed.split('=');
    const key = rawKey?.trim();
    if (!key) continue;
    const value = rest.join('=').trim();
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
})();
import { readFile } from 'node:fs/promises';
import type { Adapter, ProductLink, Credentials } from './types.js';
import type { SiteId } from './lib/sites.js';
import { newContext } from './lib/browser.js';
import { writeStorageState } from './lib/storage.js';
import { formatGBP } from './lib/price.js';
import { SITE_BY_ID } from './lib/sites.js';
import { loadCredsFor } from './lib/creds.js';
import { Romprod } from './adapters/romprod.js';
import { Mastersale } from './adapters/mastersale.js';
import { MaxyWholesale } from './adapters/maxywholesale.js';
import { RomegaFoods } from './adapters/romegafoods.js';
import { FoodexLondon } from './adapters/foodex.js';

const adapters: Record<SiteId, Adapter> = {
  romprod: new Romprod(),
  mastersale: new Mastersale(),
  maxywholesale: new MaxyWholesale(),
  romegafoods: new RomegaFoods(),
  foodex: new FoodexLondon(),
};

// Removed envCreds - now using loadCredsFor from creds.ts

function parseSiteFilter(): SiteId | undefined {
  const args = process.argv.slice(2);
  let candidate: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--site') {
      candidate = args[i + 1];
      break;
    }
    if (arg.startsWith('--site=')) {
      candidate = arg.split('=')[1];
      break;
    }
    if (!arg.startsWith('--')) {
      candidate = arg;
      break;
    }
  }

  candidate = candidate ?? process.env.SCRAPER_SITE ?? undefined;
  if (!candidate) return undefined;

  if (candidate in adapters) {
    return candidate as SiteId;
  }

  const known = Object.keys(adapters).join(', ');
  throw new Error(`Unknown site "${candidate}". Known sites: ${known}`);
}

async function runForSite(siteId: SiteId, links: ProductLink[]): Promise<void> {
  const adapter = adapters[siteId];
  if (!adapter) throw new Error(`No adapter registered for ${siteId}`);

  const ctx = await newContext(siteId);
  const page = await ctx.newPage();
  let loggedIn = false;

  try {
    if (await adapter.isLoggedIn(page)) {
      loggedIn = true;
    } else {
      try {
        await adapter.login(page, await loadCredsFor(siteId));
        loggedIn = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          JSON.stringify({
            type: 'login-error',
            siteId,
            message,
          }),
        );
      }
    }

    if (!loggedIn) {
      console.warn(`[runner] skipping ${siteId} – login failed`);
      return;
    }

    for (const link of links) {
      try {
        const result = await adapter.extractPrice(page, link);

        console.log(
          JSON.stringify({
            id: link.id ?? undefined,
            ts: new Date().toISOString(),
            siteId,
            name: link.name,
            sku: link.sku,
            url: link.url,
            searchQuery: link.searchQuery ?? null,
            currency: 'GBP',
            amount: result.amount,
            packPrice: result.packPrice ?? null,
            packSize: result.packSize ?? null,
            unitLabel: result.unitLabel ?? null,
            packLabel: result.packLabel ?? null,
            formatted: formatGBP(result.amount),
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          JSON.stringify({
            type: 'scrape-error',
            siteId,
            url: link.url,
            message,
          }),
        );
      }
    }
  } finally {
    try {
      if (siteId !== 'maxywholesale') {
        await writeStorageState(siteId, await ctx.storageState());
      }
    } catch {
      // ignore persistence errors
    }
    await ctx.close();
  }
}

async function main(): Promise<void> {
  const filter = parseSiteFilter();
  if (filter) {
    console.log(`[runner] filtering to site: ${filter}`);
  }

  const products: ProductLink[] = JSON.parse(await readFile('data/products.json', 'utf8'));
  const bySite = products.reduce<Record<SiteId, ProductLink[]>>((acc, product) => {
    if (!adapters[product.siteId]) return acc;
    (acc[product.siteId] ||= []).push(product);
    return acc;
  }, {} as Record<SiteId, ProductLink[]>);

  const siteIds = Object.keys(bySite) as SiteId[];
  const selectedSiteIds = filter ? siteIds.filter((id) => id === filter) : siteIds;

  if (selectedSiteIds.length === 0) {
    const domain = filter ? SITE_BY_ID.get(filter)?.name ?? filter : 'any site';
    console.log(`[runner] no products loaded for ${domain}`);
    return;
  }

  for (const siteId of selectedSiteIds) {
    await runForSite(siteId, bySite[siteId]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
