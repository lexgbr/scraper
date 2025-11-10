import { db, ensureSeed } from './_db';

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

  const lists = listsAgg.map((a) => {
    const site = sites.find((s) => s.id === a.siteId);
    return {
      site: site?.name || 'Site',
      items: a._count._all,
      updated: a._max.lastChecked || null,
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
