'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SiteId } from '../../../../config/sites';
import { SITE_DEFINITIONS, SITE_BY_ID, resolveSiteByName } from '../../../../config/sites';
import Card from '../../components/ui/card';
import Button from '../../components/ui/button';
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
type ProductGroup = { id: number; name: string; links: UiRow[] };
type LinkInputState = { enabled: boolean; url: string; searchQuery: string };

const inputClass =
  'w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm shadow-indigo-100/40 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100';

const createInitialLinkInputs = (): Record<SiteId, LinkInputState> =>
  SITE_DEFINITIONS.reduce(
    (acc, site) => {
      acc[site.id] = { enabled: false, url: '', searchQuery: '' };
      return acc;
    },
    {} as Record<SiteId, LinkInputState>,
  );

export default function ProductsPage() {
  const [rows, setRows] = useState<UiRow[]>([]);
  const [name, setName] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [linkInputs, setLinkInputs] = useState<Record<SiteId, LinkInputState>>(createInitialLinkInputs);
  const [filterSite, setFilterSite] = useState<SiteId | 'all'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmRow, setConfirmRow] = useState<UiRow | null>(null);

  const load = async () => {
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
  };

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo<ProductGroup[]>(() => {
    const map = new Map<number, ProductGroup>();
    for (const row of rows) {
      const group = map.get(row.product.id) || { id: row.product.id, name: row.product.name, links: [] };
      group.links.push(row);
      map.set(row.product.id, group);
    }
    return Array.from(map.values());
  }, [rows]);

  const filteredProducts = useMemo(() => {
    if (filterSite === 'all') return grouped;
    return grouped
      .map((group) => ({
        ...group,
        links: group.links.filter((link) => link.site.id === filterSite),
      }))
      .filter((group) => group.links.length > 0);
  }, [grouped, filterSite]);

  const totalTracked = rows.length;

  const toggleSite = (siteId: SiteId, enabled: boolean) => {
    setLinkInputs((prev) => ({
      ...prev,
      [siteId]: { ...prev[siteId], enabled },
    }));
  };

  const handleLinkChange = (siteId: SiteId, field: 'url' | 'searchQuery', value: string) => {
    setLinkInputs((prev) => ({
      ...prev,
      [siteId]: { ...prev[siteId], [field]: value },
    }));
  };

  const handleProductSelect = (value: string) => {
    if (!value) {
      setSelectedProductId('');
      setName('');
      return;
    }
    const id = Number(value);
    const group = grouped.find((item) => item.id === id);
    setSelectedProductId(id);
    setName(group?.name ?? '');
  };

  const addLinks = async () => {
    const payloadLinks = Object.entries(linkInputs).reduce<
      Record<string, { url?: string; searchQuery?: string }>
    >((acc, [siteId, value]) => {
      if (!value.enabled) return acc;
      acc[siteId] = {
        url: value.url.trim(),
        searchQuery: value.searchQuery.trim(),
      };
      return acc;
    }, {});

    if (Object.keys(payloadLinks).length === 0) return;
    if (!selectedProductId && !name.trim()) return;

    setIsSaving(true);
    try {
      await fetch(apiUrl('/api/products'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: selectedProductId ? undefined : name.trim(),
          productId: selectedProductId || undefined,
          links: payloadLinks,
        }),
      });
      setLinkInputs(createInitialLinkInputs());
      if (!selectedProductId) setName('');
      setSelectedProductId('');
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async (id: number) => {
    await fetch(apiUrl(`/api/products?id=${id}`), { method: 'DELETE' });
    setConfirmRow(null);
    await load();
  };

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Product list</h1>
            <p className="text-sm text-slate-500">
              Manage a single product across all marketplaces by attaching site-specific URLs or search queries.
            </p>
          </div>
          <span className="rounded-full border border-white/70 bg-white/70 px-4 py-1 text-sm font-medium text-slate-500 shadow-sm">
            {totalTracked} links
          </span>
        </div>

        <Card className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Add / update product links</h2>
            <p className="text-sm text-slate-500">
              Select an existing product or type a new name, then enable the sites that stock it.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <select
              className={inputClass}
              value={selectedProductId}
              onChange={(event) => handleProductSelect(event.target.value)}
            >
              <option value="">Add new product</option>
              {grouped.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass} lg:col-span-3`}
              placeholder="Product name"
              value={name}
              disabled={!!selectedProductId}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-4">
            {SITE_DEFINITIONS.map((site) => {
              const state = linkInputs[site.id];
              const isSearchMode = site.searchMode === 'query';
              return (
                <div key={site.id} className="space-y-2 rounded-2xl border border-slate-100/80 p-4">
                  <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      checked={state.enabled}
                      onChange={(event) => toggleSite(site.id, event.target.checked)}
                    />
                    Track {site.name}
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      className={inputClass}
                      placeholder={`${site.name} product URL`}
                      value={state.url}
                      disabled={!state.enabled || isSearchMode}
                      onChange={(event) => handleLinkChange(site.id, 'url', event.target.value)}
                    />
                    {isSearchMode && (
                      <input
                        className={inputClass}
                        placeholder="Search query (defaults to product name)"
                        value={state.searchQuery}
                        disabled={!state.enabled}
                        onChange={(event) => handleLinkChange(site.id, 'searchQuery', event.target.value)}
                      />
                    )}
                  </div>
                  {isSearchMode && (
                    <p className="text-xs text-slate-500">
                      This marketplace only exposes a catalogue. Leave the search query empty to reuse the product name.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={addLinks} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save links'}
            </Button>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tracked products</h2>
              <p className="text-sm text-slate-500">Expand each product to review site-specific settings.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterSite('all')}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filterSite === 'all'
                    ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-300'
                    : 'bg-white/80 text-slate-500 hover:text-indigo-600'
                }`}
              >
                All sites
              </button>
              {SITE_DEFINITIONS.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => setFilterSite(site.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    filterSite === site.id
                      ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-300'
                      : 'bg-white/80 text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
              No products yet. Add your first URLs above.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-lg font-semibold text-slate-900">{product.name}</div>
                    <span className="text-xs text-slate-500">{product.links.length} links</span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-100/80">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Site</th>
                          <th className="px-4 py-3 text-left">URL / Search</th>
                          <th className="px-4 py-3 text-right">Unit price</th>
                          <th className="px-4 py-3 text-right">Pack price</th>
                          <th className="px-4 py-3 text-right">Last check</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/70">
                        {product.links.map((link) => (
                          <tr key={link.id} className="bg-white/70">
                            <td className="px-4 py-3 font-medium text-slate-800">
                              <Badge className="w-fit bg-indigo-500/10 text-indigo-600">
                                {link.site.name ?? 'Unknown site'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 align-top space-y-1">
                              {link.url ? (
                                <a
                                  className="text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:text-indigo-700"
                                  href={link.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {link.url}
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">Search driven</span>
                              )}
                              {link.searchQuery && (
                                <div className="text-xs text-slate-500">Query: {link.searchQuery}</div>
                              )}
                              {link.selector && (
                                <div className="text-xs text-slate-400">
                                  Selector: <code>{link.selector}</code>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-700 align-top">
                              {link.lastPriceUnit != null ? `${link.lastPriceUnit.toFixed(2)} GBP` : '--'}
                              {link.unitLabel ? (
                                <span className="text-xs text-slate-500"> / {link.unitLabel}</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-700 align-top">
                              {link.lastPricePack != null ? `${link.lastPricePack.toFixed(2)} GBP` : '--'}
                              {link.packLabel ? (
                                <span className="text-xs text-slate-500">
                                  {' '}
                                  / {link.packLabel}
                                  {link.packSize ? ` (${link.packSize})` : ''}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-slate-500 align-top">
                              {link.lastChecked ? new Date(link.lastChecked).toLocaleString() : '--'}
                            </td>
                            <td className="px-4 py-3 text-right align-top">
                              <Button variant="ghost" onClick={() => setConfirmRow(link)}>
                                Remove
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {confirmRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-white/70 bg-white p-6 shadow-xl shadow-indigo-200/50">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">Remove product link?</h3>
              <p className="text-sm text-slate-500">
                This will delete{' '}
                <span className="font-semibold text-slate-800">{confirmRow.product.name}</span> on{' '}
                {confirmRow.site.name} and its saved prices.
              </p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmRow(null)}>
                Keep
              </Button>
              <Button variant="danger" onClick={() => confirmDelete(confirmRow.id)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
