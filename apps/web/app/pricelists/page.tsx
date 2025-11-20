'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SiteId } from '../../../../config/sites';
import { SITE_DEFINITIONS, SITE_BY_ID, resolveSiteByName } from '../../../../config/sites';
import Card from '../../components/ui/card';
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

type ProductRow = {
  productId: number;
  productName: string;
  suppliers: Map<string, { unitPrice: number | null; packPrice: number | null; lastChecked: string | null }>;
  trend: 'up' | 'down' | 'stable';
};

const inputClass =
  'w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm shadow-indigo-100/40 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100';

export default function PriceListsPage() {
  const [rows, setRows] = useState<UiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  const productRows = useMemo(() => {
    const productMap = new Map<number, ProductRow>();

    for (const row of rows) {
      if (!productMap.has(row.product.id)) {
        productMap.set(row.product.id, {
          productId: row.product.id,
          productName: row.product.name,
          suppliers: new Map(),
          trend: 'stable',
        });
      }

      const productRow = productMap.get(row.product.id)!;
      productRow.suppliers.set(row.site.name, {
        unitPrice: row.lastPriceUnit ?? null,
        packPrice: row.lastPricePack ?? null,
        lastChecked: row.lastChecked ?? null,
      });
    }

    return Array.from(productMap.values());
  }, [rows]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return productRows;
    const query = searchQuery.toLowerCase();
    return productRows.filter((p) => p.productName.toLowerCase().includes(query));
  }, [productRows, searchQuery]);

  const allSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    for (const product of productRows) {
      for (const supplier of product.suppliers.keys()) {
        suppliers.add(supplier);
      }
    }
    return Array.from(suppliers);
  }, [productRows]);

  const getTrendBadge = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
          ↑ Rise
        </span>
      );
    }
    if (trend === 'down') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
          ↓ Down
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
        = Stable
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Price Lists</h1>
          <p className="text-sm text-slate-500">
            Compare prices across all suppliers. Use the search to find specific products.
          </p>
        </div>
        <span className="rounded-full border border-white/70 bg-white/70 px-4 py-1 text-sm font-medium text-slate-500 shadow-sm">
          {productRows.length} products
        </span>
      </div>

      <Card className="space-y-4">
        <input
          type="text"
          className={inputClass}
          placeholder="Search products by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {loading ? (
          <div className="text-sm text-slate-500">Loading price data...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-sm text-slate-500">
            {searchQuery ? 'No products match your search.' : 'No price data available yet. Run the scraper to populate.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="overflow-hidden rounded-2xl border border-slate-100/80">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left sticky left-0 bg-slate-50/80">Product Name</th>
                    <th className="px-4 py-3 text-center">Trend</th>
                    {allSuppliers.map((supplier) => (
                      <th key={supplier} className="px-4 py-3 text-right">
                        {supplier}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Last Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {filteredProducts.map((product) => {
                    const lastChecked = Array.from(product.suppliers.values())
                      .map((s) => s.lastChecked)
                      .filter((d) => d)
                      .sort()
                      .pop();

                    return (
                      <tr key={product.productId} className="bg-white/70">
                        <td className="px-4 py-3 font-semibold text-slate-800 sticky left-0 bg-white/70">
                          {product.productName}
                        </td>
                        <td className="px-4 py-3 text-center">{getTrendBadge(product.trend)}</td>
                        {allSuppliers.map((supplier) => {
                          const prices = product.suppliers.get(supplier);
                          return (
                            <td key={supplier} className="px-4 py-3 text-right align-top">
                              {prices ? (
                                <div className="space-y-1">
                                  <div className="font-semibold text-slate-700">
                                    {prices.unitPrice != null ? `${prices.unitPrice.toFixed(2)} GBP` : '--'}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {prices.packPrice != null ? `Pack: ${prices.packPrice.toFixed(2)} GBP` : ''}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">--</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right text-xs text-slate-500 align-top">
                          {lastChecked ? new Date(lastChecked).toLocaleString() : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
