import { db, ensureSeed } from './_db';
import { SITE_DEFINITIONS } from '../../../../config/sites';

export default async function handler(req: any, res: any) {
  await ensureSeed();
  const prisma = db();
  const [lastRun, feed, listsAgg, sites] = await Promise.all([
    prisma.queryRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.priceChange.findMany({
      take: 10,
      orderBy: { changedAt: 'desc' },
      include: { productLink: { include: { product: true, site: true } } },
    }),
    prisma.productLink.groupBy({
      by: ['siteId'],
      _count: { _all: true },
      _max: { lastChecked: true },
    }),
    prisma.site.findMany(),
  ]);

  const status = lastRun
    ? {
        lastRun: lastRun.finishedAt || lastRun.startedAt,
        status: lastRun.status,
        etaSec: lastRun.etaSec ?? undefined,
        elapsedSec: lastRun.finishedAt
          ? Math.round((+lastRun.finishedAt - +lastRun.startedAt) / 1000)
          : Math.round((Date.now() - +lastRun.startedAt) / 1000),
      }
    : null;

  const aggMap = new Map<number, (typeof listsAgg)[number]>();
  for (const entry of listsAgg) {
    aggMap.set(entry.siteId, entry);
  }

  const lists = SITE_DEFINITIONS.map((siteDef) => {
    const siteRecord = sites.find((s) => s.name === siteDef.name);
    const agg = siteRecord ? aggMap.get(siteRecord.id) : undefined;
    return {
      siteId: siteDef.id,
      site: siteDef.name,
      items: agg?._count._all ?? 0,
      updated: agg?._max.lastChecked || null,
      mode: siteDef.id === 'foodex' ? 'manual' : 'auto',
    };
  });

  res.json({
    status,
    feed: feed.map((f) => ({
      product: f.productLink.product.name,
      site: f.productLink.site.name,
      old: f.old,
      new: f.new,
      changedAt: f.changedAt,
    })),
    lists,
  });
}
