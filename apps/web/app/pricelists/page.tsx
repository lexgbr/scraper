'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SiteId } from '../../../../config/sites';
import { SITE_DEFINITIONS, SITE_BY_ID, resolveSiteByName } from '../../../../config/sites';
import Card from '../../components/ui/card';
import Badge from '../../components/ui/badge';
import { apiUrl } from '../../lib/api';

type ApiRow = {
  id: number;
  url: string;
  selector?: string | null;
  searchQuery?: string | null;
  lastPrice: number | null;
  lastPriceUnit?: number | null;
  lastPricePack?: number | null;
  packSize?: number | null;
  unitLabel?: string | null;
  packLabel?: string | null;
  lastChecked?: string | null;
  product: { id: number; name: string };
  site: { id?: SiteId | null; name: string };
};

type UiRow = ApiRow & { preferredLabel: string };

export default function PriceListsPage() {
  const [rows, setRows] = useState<UiRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(apiUrl('/api/products'));
        const data = await response.json();
        const normalized: UiRow[] = (data.rows as ApiRow[]).map((row) => {
          const resolvedId =
            (row.site.id as SiteId | undefined | null) ?? resolveSiteByName(row.site.name)?.id ?? null;
          const finalId = resolvedId as SiteId | null;
          const preferredLabel = finalId ? SITE_BY_ID.get(finalId)?.name ?? row.site.name : row.site.name;
          return {
            ...row,
            site: { ...row.site, id: finalId ?? undefined, name: preferredLabel },
            preferredLabel,
          };
        });
        setRows(normalized);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<SiteId | string, UiRow[]>();
    for (const row of rows) {
      const key = row.site.id ?? row.site.name;
      const list = map.get(key) || [];
      list.push(row);
      map.set(key, list);
    }

    const ordered: { key: SiteId | string; rows: UiRow[] }[] = [];
    for (const site of SITE_DEFINITIONS) {
      if (map.has(site.id)) {
        ordered.push({ key: site.id, rows: map.get(site.id)! });
      }
    }

    // Include any unknown sites as a fallback
    for (const [key, list] of map.entries()) {
      if (!SITE_DEFINITIONS.find((s) => s.id === key)) {
        ordered.push({ key, rows: list });
      }
    }

    return ordered;
  }, [rows]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Price Lists</h1>
        <p className="text-sm text-slate-500">
          Latest scraped prices grouped by marketplace. Use this as a quick reference before exporting data.
        </p>
      </div>

      {loading ? (
        <Card>
          <div className="text-sm text-slate-500">Loading price data...</div>
        </Card>
      ) : grouped.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-500">No price data available yet. Run the scraper to populate.</div>
        </Card>
      ) : (
        grouped.map(({ key, rows: siteRows }) => {
          const definition = SITE_BY_ID.get(key as SiteId);
          const siteName = definition?.name ?? String(key);
          return (
            <Card key={String(key)} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-slate-900">{siteName}</div>
                <Badge className="bg-indigo-500/10 text-indigo-600">
                  {siteRows.length} {siteRows.length === 1 ? 'product' : 'products'}
                </Badge>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-100/80">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">URL / Search</th>
                      <th className="px-4 py-3 text-right">Unit price</th>
                      <th className="px-4 py-3 text-right">Pack price</th>
                      <th className="px-4 py-3 text-right">Last check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/70">
                    {siteRows.map((row) => (
                      <tr key={row.id} className="bg-white/70">
                        <td className="px-4 py-3 font-semibold text-slate-800">{row.product.name}</td>
                        <td className="px-4 py-3 align-top space-y-1">
                          {row.url ? (
                            <a
                              className="text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-700"
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {row.url}
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Search driven</span>
                          )}
                          {row.searchQuery && (
                            <div className="text-xs text-slate-500">Query: {row.searchQuery}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700 align-top">
                          {row.lastPriceUnit != null ? `${row.lastPriceUnit.toFixed(2)} GBP` : '--'}
                          {row.unitLabel ? (
                            <span className="text-xs text-slate-500"> / {row.unitLabel}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700 align-top">
                          {row.lastPricePack != null ? `${row.lastPricePack.toFixed(2)} GBP` : '--'}
                          {row.packLabel ? (
                            <span className="text-xs text-slate-500">
                              {' '}
                              / {row.packLabel}
                              {row.packSize ? ` (${row.packSize})` : ''}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-500 align-top">
                          {row.lastChecked ? new Date(row.lastChecked).toLocaleString() : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
