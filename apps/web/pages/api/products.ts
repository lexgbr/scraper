import type { NextApiRequest, NextApiResponse } from 'next';
import type { SiteId } from '../../../../config/sites';
import { SITE_DEFINITIONS, SITE_BY_ID, resolveSiteByName } from '../../../../config/sites';
import { db } from './_db';

const SITE_BY_HOST = new Map(
  SITE_DEFINITIONS.map((site) => [new URL(site.baseUrl).hostname, site] as const),
);

function pickSiteId(name: string, base: string): SiteId | null {
  const byName = resolveSiteByName(name)?.id;
  if (byName) return byName;

  try {
    const host = new URL(base).hostname;
    const match = SITE_BY_HOST.get(host);
    if (match) return match.id;
  } catch {
    // ignore invalid URL
  }

  return null;
}

async function ensureSiteRecord(siteId: SiteId) {
  const prisma = db();
  const def = SITE_BY_ID.get(siteId);
  if (!def) throw new Error(`Unknown site definition for ${siteId}`);

  const existing = await prisma.site.findFirst({ where: { name: def.name } });
  if (existing) return existing;

  return prisma.site.create({
    data: { name: def.name, base: def.baseUrl },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const rows = await db().productLink.findMany({
      include: { product: true, site: true },
      orderBy: { id: 'desc' },
    });

    const normalized = rows.map((row) => {
      const siteSlug = pickSiteId(row.site.name, row.site.base);
      return {
        id: row.id,
        url: row.url,
        selector: row.selector,
        searchQuery: row.searchQuery,
        lastPrice: row.lastPrice,
        lastPriceUnit: row.lastPriceUnit ?? row.lastPrice,
        lastPricePack: row.lastPricePack ?? null,
        packSize: row.packSize ?? null,
        unitLabel: row.unitLabel ?? null,
        packLabel: row.packLabel ?? null,
        lastChecked: row.lastChecked,
        product: {
          id: row.productId,
          name: row.product.name,
        },
        site: {
          id: siteSlug,
          name: row.site.name,
          siteId: row.siteId,
        },
      };
    });

    return res.json({ rows: normalized });
  }

  if (req.method === 'POST') {
    const { name, productId, links } = req.body ?? {};

    if (!productId && !name) {
      return res.status(400).json({ ok: false, error: 'name or productId required' });
    }

    if (!links || typeof links !== 'object') {
      return res.status(400).json({ ok: false, error: 'links payload required' });
    }

    const entries = Object.entries(links).filter(
      ([, value]) => value && (typeof (value as any).url === 'string' || typeof (value as any).searchQuery === 'string'),
    ) as [string, { url?: string; selector?: string | null; searchQuery?: string }][];

    if (entries.length === 0) {
      return res.status(400).json({ ok: false, error: 'at least one site link or search query is required' });
    }

    const prisma = db();
    let product = null;

    if (productId) {
      product = await prisma.product.findUnique({ where: { id: Number(productId) } });
      if (!product) {
        return res.status(404).json({ ok: false, error: 'productId not found' });
      }
    } else {
      product =
        (await prisma.product.findFirst({ where: { name: name.trim() } })) ??
        (await prisma.product.create({ data: { name: String(name).trim() } }));
    }

    let updated = 0;

    await prisma.$transaction(async (tx) => {
      for (const [siteKey, value] of entries) {
        const siteSlug = siteKey as SiteId;
        if (!SITE_BY_ID.has(siteSlug)) continue;

        const def = SITE_BY_ID.get(siteSlug);
        const siteRecord = await ensureSiteRecord(siteSlug);
        const selector = value.selector ?? def?.defaultSelector ?? null;
        const trimmedUrl = typeof value.url === 'string' ? value.url.trim() : '';
        const trimmedQuery = typeof value.searchQuery === 'string' ? value.searchQuery.trim() : '';

        let finalUrl = trimmedUrl;
        let finalQuery: string | null = trimmedQuery || null;

        if (def?.searchMode === 'query') {
          finalUrl = trimmedUrl || def.searchUrl || def.baseUrl;
          if (!finalQuery) {
            finalQuery = name?.trim() || product?.name || null;
          }
          if (!finalQuery) continue;
        } else if (!finalUrl) {
          continue;
        }

        const existingLink = await tx.productLink.findFirst({
          where: { productId: product!.id, siteId: siteRecord.id },
        });

        if (existingLink) {
          await tx.productLink.update({
            where: { id: existingLink.id },
            data: { url: finalUrl, selector, searchQuery: finalQuery },
          });
        } else {
          await tx.productLink.create({
            data: {
              productId: product!.id,
              siteId: siteRecord.id,
              url: finalUrl,
              selector,
              searchQuery: finalQuery,
            },
          });
        }
        updated += 1;
      }
    });

    return res.json({ ok: true, productId: product.id, updated });
  }

  if (req.method === 'DELETE') {
    const rawId = (req.query?.id ?? req.body?.id) as string | string[] | undefined;
    const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: 'id required' });
    }

    try {
      await db().$transaction(async (tx) => {
        const link = await tx.productLink.findUnique({
          where: { id },
          include: { product: true },
        });
        if (!link) {
          throw Object.assign(new Error('not_found'), { code: 'NOT_FOUND' });
        }

        await tx.priceSnapshot.deleteMany({ where: { productLinkId: id } });
        await tx.priceChange.deleteMany({ where: { productLinkId: id } });
        await tx.productLink.delete({ where: { id } });

        const remainingLinks = await tx.productLink.count({
          where: { productId: link.productId },
        });
        if (remainingLinks === 0) {
          await tx.product.delete({ where: { id: link.productId } });
        }
      });

      return res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'NOT_FOUND') {
        return res.status(404).json({ ok: false, error: 'product not found' });
      }
      console.error('[api/products:delete]', err);
      return res.status(500).json({ ok: false, error: 'failed to delete product' });
    }
  }

  res.status(405).end();
}

