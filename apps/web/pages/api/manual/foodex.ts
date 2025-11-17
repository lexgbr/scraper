import type { NextApiRequest, NextApiResponse } from 'next';
import { db, ensureSeed } from '../_db';
import { SITE_DEFINITIONS } from '../../../../../config/sites';

const FOODEX_DEF = SITE_DEFINITIONS.find((site) => site.id === 'foodex');
const FOODEX_NAME = FOODEX_DEF?.name ?? 'Foodex London';

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function handleGet(siteId: number, res: NextApiResponse, prisma: ReturnType<typeof db>) {
  const links = await prisma.productLink.findMany({
    where: { siteId },
    include: { product: true },
    orderBy: { id: 'asc' },
  });

  res.json({
    site: FOODEX_NAME,
    count: links.length,
    links: links.map((link) => ({
      id: link.id,
      productName: link.product.name,
      url: link.url,
      selector:
        (() => {
          const raw = (link.selector ?? '').trim();
          if (!raw || /^price$/i.test(raw)) return FOODEX_DEF?.defaultSelector ?? null;
          return raw;
        })(),
      searchQuery: link.searchQuery,
      lastPriceUnit: link.lastPriceUnit,
      lastPricePack: link.lastPricePack,
      packSize: link.packSize,
      unitLabel: link.unitLabel,
      packLabel: link.packLabel,
      lastChecked: link.lastChecked,
    })),
  });
}

async function handlePost(siteId: number, req: NextApiRequest, res: NextApiResponse, prisma: ReturnType<typeof db>) {
  const entriesRaw = Array.isArray(req.body?.entries)
    ? req.body.entries
    : Array.isArray(req.body)
      ? req.body
      : [];

  if (entriesRaw.length === 0) {
    return res.status(400).json({ error: 'Missing entries payload.' });
  }

  let updated = 0;

  for (const entry of entriesRaw) {
    const id = Number(entry?.id);
    const unitPrice = normalizeNumber(entry?.unitPrice ?? entry?.amount ?? entry?.price);
    if (!Number.isFinite(id) || unitPrice == null) continue;

    const packPrice = normalizeNumber(entry?.packPrice);
    const packSize = normalizeNumber(entry?.packSize);
    const unitLabel =
      typeof entry?.unitLabel === 'string' && entry.unitLabel.trim().length > 0
        ? entry.unitLabel.trim()
        : null;
    const packLabel =
      typeof entry?.packLabel === 'string' && entry.packLabel.trim().length > 0
        ? entry.packLabel.trim()
        : null;
    let when = entry?.capturedAt ? new Date(entry.capturedAt) : new Date();
    if (Number.isNaN(+when)) when = new Date();

    try {
      await prisma.$transaction(async (tx) => {
        const previous = await tx.productLink.findUnique({
          where: { id },
          select: { siteId: true, lastPrice: true },
        });
        if (!previous || previous.siteId !== siteId) return;

        await tx.productLink.update({
          where: { id },
          data: {
            lastPrice: unitPrice,
            lastPriceUnit: unitPrice,
            lastPricePack: packPrice,
            packSize,
            unitLabel,
            packLabel,
            lastChecked: when,
          },
        });

        await tx.priceSnapshot.create({
          data: {
            productLinkId: id,
            price: unitPrice,
            unitPrice,
            packPrice,
            packSize,
            capturedAt: when,
          },
        });

        if (previous.lastPrice != null && previous.lastPrice !== unitPrice) {
          await tx.priceChange.create({
            data: { productLinkId: id, old: previous.lastPrice, new: unitPrice, changedAt: when },
          });
        }
      });

      updated += 1;
    } catch (err) {
      console.error('[manual:foodex] failed to persist entry', err);
    }
  }

  res.json({ ok: true, updated });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureSeed();
  const prisma = db();

  const foodexSite = await prisma.site.findFirst({ where: { name: FOODEX_NAME } });
  if (!foodexSite) {
    return res.status(404).json({ error: 'Foodex site is not configured yet.' });
  }

  if (req.method === 'GET') {
    return handleGet(foodexSite.id, res, prisma);
  }
  if (req.method === 'POST') {
    return handlePost(foodexSite.id, req, res, prisma);
  }

  return res.status(405).end();
}
