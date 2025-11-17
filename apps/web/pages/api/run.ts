import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import type { SiteId } from '../../../../config/sites';
import { SITE_BY_ID, resolveSiteByName } from '../../../../config/sites';

const prisma = new PrismaClient();

type ScraperProduct = {
  id: number;
  name: string;
  siteId: SiteId;
  url: string;
  selector?: string | null;
  searchQuery?: string | null;
};

function inferSiteId(input: any): SiteId | undefined {
  const explicit = input?.site?.id;
  if (explicit && SITE_BY_ID.has(explicit as any)) {
    return explicit as SiteId;
  }
  const fallback = input?.site?.name ? resolveSiteByName(String(input.site.name)) : undefined;
  return fallback?.id;
}

async function loadProducts(base: string, siteFilter?: SiteId): Promise<ScraperProduct[]> {
  const r = await fetch(`${base}/api/products`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`/api/products ${r.status}`);
  const { rows } = await r.json();
  const products: ScraperProduct[] = [];

  for (const raw of rows ?? []) {
    if (!raw?.url || raw?.id == null) continue;
    const siteId = inferSiteId(raw);
    if (!siteId) continue;
    if (siteFilter && siteId !== siteFilter) continue;
    products.push({
      id: Number(raw.id),
      name: raw.product?.name ?? 'Unknown',
      siteId,
      url: String(raw.url),
      selector: raw.selector ?? SITE_BY_ID.get(siteId)?.defaultSelector ?? null,
      searchQuery: raw.searchQuery ?? null,
    });
  }

  return products;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const siteRaw = (req.body?.siteId ?? req.query?.siteId) as string | undefined;
  const siteFilter = siteRaw && SITE_BY_ID.has(siteRaw as SiteId) ? (siteRaw as SiteId) : undefined;
  if (siteFilter === 'foodex') {
    return res.status(400).json({ error: 'Foodex London requires the manual capture flow.' });
  }

  // 1) prepare list for the scraper
  const base = process.env.SELF_BASE_URL || 'http://localhost:3000';
  const products = await loadProducts(base, siteFilter);

  const root = path.resolve(process.cwd(), '..', '..'); // apps/web -> repo root
  const dataPath = path.join(root, 'data', 'products.json');
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(products, null, 2), 'utf8');

  const total = products.length;
  const etaSec = total > 0 ? Math.max(20, total * 8) : null;
  const notePrefix = siteFilter ? `site:${siteFilter}` : 'all-sites';
  const run = await prisma.queryRun.create({
    data: {
      status: 'running',
      etaSec,
      note: total ? `${notePrefix}:${total}` : `${notePrefix}:empty`,
    },
  });

  let processed = 0;
  let hadErrors = false;

  // 2) run the scraper (Windows friendly)
  const jsRunner = path.join(root, 'dist', 'runner.js');
  const tsxCli   = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const args     = fsSync.existsSync(jsRunner) ? [jsRunner] : [tsxCli, 'src/runner.ts'];

  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...process.env, SCRAPER_CONCURRENCY: '1' }, // single concurrent login per site
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  const handleLine = async (raw: string) => {
    const t = raw.trim();
    if (!t || t[0] !== '{') return;

    let payload: any;
    try {
      payload = JSON.parse(t);
    } catch (err) {
      hadErrors = true;
      console.error('[parse]', err);
      return;
    }

    if (payload?.type === 'scrape-error') {
      hadErrors = true;
      console.error('[scraper:error]', payload.message ?? 'unknown error', payload.url ?? '');
      return;
    }

    const id = Number(payload?.id);
    if (!Number.isFinite(id)) {
      hadErrors = true;
      console.warn('[db] missing id, skipped:', payload?.url);
      return;
    }

    const when = new Date(payload.ts ?? Date.now());
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount)) {
      hadErrors = true;
      console.warn('[db] invalid amount for id', id, 'payload:', payload);
      return;
    }

    const packPrice =
      payload.packPrice == null || payload.packPrice === ''
        ? null
        : Number(payload.packPrice);
    const packSize =
      payload.packSize == null || payload.packSize === ''
        ? null
        : Number(payload.packSize);
    const unitLabel =
      typeof payload.unitLabel === 'string' && payload.unitLabel.trim().length > 0
        ? payload.unitLabel.trim()
        : null;
    const packLabel =
      typeof payload.packLabel === 'string' && payload.packLabel.trim().length > 0
        ? payload.packLabel.trim()
        : null;

    try {
      await prisma.$transaction(async (tx) => {
        const previous = await tx.productLink.findUnique({
          where: { id },
          select: {
            lastPrice: true,
            lastPriceUnit: true,
            lastPricePack: true,
            packSize: true,
            unitLabel: true,
            packLabel: true,
          },
        });

        if (!previous) {
          hadErrors = true;
          console.warn('[db] productLink not found for id', id);
          return;
        }

        await tx.productLink.update({
          where: { id },
          data: {
            lastPrice: amount,
            lastPriceUnit: amount,
            lastPricePack: Number.isFinite(packPrice ?? NaN) ? packPrice : null,
            packSize: Number.isFinite(packSize ?? NaN) ? packSize : null,
            unitLabel,
            packLabel,
            lastChecked: when,
          },
        });

        await tx.priceSnapshot.create({
          data: {
            productLinkId: id,
            price: amount,
            unitPrice: amount,
            packPrice: Number.isFinite(packPrice ?? NaN) ? packPrice : null,
            packSize: Number.isFinite(packSize ?? NaN) ? packSize : null,
            capturedAt: when,
          },
        });

        if (previous.lastPrice != null && previous.lastPrice !== amount) {
          await tx.priceChange.create({
            data: { productLinkId: id, old: previous.lastPrice, new: amount, changedAt: when },
          });
        }
      });

      processed += 1;
      if (total > 0) {
        await prisma.queryRun.update({
          where: { id: run.id },
          data: { note: `${processed}/${total}` },
        });
      }
      console.log('[db] updated by id', id);
    } catch (err) {
      hadErrors = true;
      console.error('[db]', err);
    }
  };

  // 3) persist results by ID only
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    for (const raw of chunk.split('\n')) {
      void handleLine(raw).catch((err) => {
        hadErrors = true;
        console.error('[db] line handling failed', err);
      });
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d: string) => {
    hadErrors = true;
    console.error('[scraper]', d.trim());
  });

  child.on('close', async (code) => {
    const finishedAt = new Date();
    const status = code === 0 && !hadErrors ? 'done' : 'error';
    try {
      await prisma.queryRun.update({
        where: { id: run.id },
        data: {
          status,
          finishedAt,
          note: total > 0 ? `${processed}/${total}` : run.note,
        },
      });
    } catch (err) {
      console.error('[db] failed to finalize run', err);
    }
    console.log('[scraper] exited', code);
  });

  // immediate response for the UI - scraper continues in background
  res.json({ ok: true, count: products.length, siteId: siteFilter ?? null });
}

