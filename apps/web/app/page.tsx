'use client';
import { useEffect, useMemo, useState } from 'react';
import type { SiteId } from '../../../config/sites';
import Card from '../components/ui/card';
import Button from '../components/ui/button';
import Progress from '../components/ui/progress';
import Badge from '../components/ui/badge';
import { apiUrl } from '../lib/api';

type HomeStatus = {
  lastRun?: string;
  status?: string;
  etaSec?: number;
  elapsedSec?: number;
};

type FeedRow = {
  product: string;
  site: string;
  old: number;
  new: number;
  changedAt: string;
};

type ListRow = {
  site: string;
  siteId: SiteId;
  items: number;
  updated?: string | null;
  mode?: 'auto' | 'manual';
};

export default function Home() {
  const [status, setStatus] = useState<HomeStatus | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [activeTrigger, setActiveTrigger] = useState<'all' | SiteId | null>(null);
  const [showFoodexGuide, setShowFoodexGuide] = useState(false);

  const refresh = async () => {
    const response = await fetch(apiUrl('/api/home'));
    const data = await response.json();
    setStatus(data.status ?? null);
    setFeed(data.feed ?? []);
    setLists(data.lists ?? []);
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, []);

  const triggerRun = async (siteId?: SiteId) => {
    setActiveTrigger(siteId ?? 'all');
    try {
      await fetch(apiUrl('/api/run'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(siteId ? { siteId } : {}),
      });
      await refresh();
    } finally {
      setActiveTrigger(null);
    }
  };

  const progress = useMemo(() => {
    if (status?.status !== 'running' || !status.etaSec) return 0;
    const ratio = (status.elapsedSec || 0) / status.etaSec;
    return Math.min(99, Math.max(5, Math.round(ratio * 100)));
  }, [status]);

  const lastRunLabel = status?.lastRun
    ? new Date(status.lastRun).toLocaleString()
    : 'No runs yet';
  const isGlobalBusy = status?.status === 'running' || activeTrigger !== null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Monitor price updates across all connected marketplaces and trigger a fresh scrape whenever you need.
          </p>
        </div>
        <Button onClick={() => triggerRun()} disabled={isGlobalBusy}>
          {status?.status === 'running'
            ? 'Scraper running...'
            : activeTrigger === 'all'
              ? 'Starting...'
              : 'Run scraper'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Last run</p>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{lastRunLabel}</div>
            </div>
            <Badge className={status?.status === 'running' ? '!border-emerald-100 !bg-emerald-50 !text-emerald-600' : ''}>
              {status?.status === 'running' ? 'In progress' : 'Idle'}
            </Badge>
          </div>
          {status?.status === 'running' && (
            <div className="space-y-2 rounded-2xl border border-indigo-100/70 bg-indigo-50/70 p-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Scraping in progress</span>
                <span className="font-medium text-indigo-600">{progress}%</span>
              </div>
              <Progress value={progress} />
              <div className="text-xs text-slate-500">Approx ETA ~ {status.etaSec}s</div>
            </div>
          )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Current sites</p>
            <h2 className="text-xl font-semibold text-slate-900">Scraper controls</h2>
          </div>
          <span className="text-sm font-medium text-indigo-600">{lists.length} sites</span>
        </div>
        <div className="space-y-3">
          {lists.map((list) => {
            const isManual = list.mode === 'manual' || list.siteId === ('foodex' as SiteId);
            const isSiteBusy = activeTrigger === list.siteId;
            const productLabel = list.items === 1 ? 'product' : 'products';
            return (
              <div
                key={list.siteId}
                className="flex flex-col gap-3 rounded-2xl border border-indigo-100/70 bg-white/80 p-4 shadow-sm shadow-indigo-100/40 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    {list.site}
                    {isManual && (
                      <Badge className="!border-amber-200 !bg-amber-50 !text-amber-600">Manual</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {list.items} {productLabel} · Last check:{' '}
                    {list.updated ? new Date(list.updated).toLocaleString() : 'No data yet'}
                  </div>
                </div>
                {isManual ? (
                  <Button variant="ghost" onClick={() => setShowFoodexGuide(true)}>
                    View tutorial
                  </Button>
                ) : (
                  <Button onClick={() => triggerRun(list.siteId)} disabled={isGlobalBusy}>
                    {isSiteBusy ? 'Starting...' : 'Scrape now'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Recent activity</p>
            <h2 className="text-xl font-semibold text-slate-900">Price changes</h2>
          </div>
          <Badge>{feed.length ? `${feed.length} updates` : 'No changes yet'}</Badge>
        </div>
        {feed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
            Run the scraper to capture the first price change.
          </div>
        ) : (
          <ul className="grid gap-3 text-sm">
            {feed.map((f, i) => {
              const directionDown = f.new < f.old;
              return (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm"
                >
                  <Badge
                    className={
                      directionDown
                        ? '!border-emerald-200 !bg-emerald-50 !text-emerald-600'
                        : '!border-rose-200 !bg-rose-50 !text-rose-600'
                    }
                  >
                    {directionDown ? 'Price drop' : 'Price rise'}
                  </Badge>
                  <div className="space-y-1 leading-relaxed">
                    <div>
                      <span className="font-semibold text-slate-800">{f.product}</span>{' '}
                      on <span className="font-medium text-indigo-600">{f.site}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {f.old} {'->'} {f.new} GBP @ {new Date(f.changedAt).toLocaleString()}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {showFoodexGuide && <ManualGuideModal onClose={() => setShowFoodexGuide(false)} />}
    </div>
  );
}

function ManualGuideModal({ onClose }: { onClose: () => void }) {
  const linkButton =
    'inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-sm shadow-indigo-100/50 transition hover:-translate-y-0.5 hover:bg-indigo-50 hover:text-indigo-700';

  const downloadButton =
    'inline-flex items-center justify-center rounded-2xl border-2 border-indigo-500 bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-300/50 transition hover:-translate-y-0.5 hover:bg-indigo-600 hover:border-indigo-600';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl my-8 rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Foodex manual capture</h3>
            <p className="mt-1 text-sm text-slate-500">
              Foodex requires a verified Cloudflare session. Follow the steps below to set up and use the Chrome extension.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 p-4">
            <h4 className="font-semibold text-slate-900 mb-3">📦 Step 1: Download the Extension</h4>
            <p className="text-sm text-slate-600 mb-3">
              Download the Foodex Helper Chrome extension from your project directory.
            </p>
            <a className={downloadButton} href="/extensions/foodex-helper.zip" download="foodex-helper.zip">
              ⬇️ Download Foodex Helper Extension
            </a>
            <p className="text-xs text-slate-500 mt-2">
              Extension location: <code className="bg-white rounded px-1 py-0.5">extensions/foodex-helper/</code>
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-900 mb-3">🔧 Step 2: Install the Extension in Chrome</h4>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Open Chrome and navigate to <code className="bg-white rounded px-1 py-0.5">chrome://extensions/</code></li>
              <li>Enable <span className="font-semibold text-slate-900">"Developer mode"</span> using the toggle in the top-right corner</li>
              <li>Click <span className="font-semibold text-slate-900">"Load unpacked"</span> button</li>
              <li>Navigate to and select the <code className="bg-white rounded px-1 py-0.5">extensions/foodex-helper/</code> folder in your project</li>
              <li>The extension icon should now appear in your Chrome toolbar</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-900 mb-3">✅ Step 3: Activate the Extension</h4>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Click the Foodex Helper extension icon in your Chrome toolbar</li>
              <li>In the popup, enter your API URL: <code className="bg-white rounded px-1 py-0.5">http://localhost:3000</code> (or your deployed URL)</li>
              <li>Click <span className="font-semibold text-slate-900">"Save"</span> to store the configuration</li>
              <li>The extension is now ready to use</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-900 mb-3">🚀 Step 4: Run the Price Scrape</h4>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>
                Click <span className="font-semibold text-slate-900">"Open Foodex login"</span> below and sign in to Foodex manually
              </li>
              <li>Keep the Foodex tab open (cookies must stay active)</li>
              <li>Click the Foodex Helper extension icon</li>
              <li>Click <span className="font-semibold text-slate-900">"Scrape Prices"</span> button in the popup</li>
              <li>Wait for the extension to fetch products and scrape prices (progress shown in popup)</li>
              <li>Once complete, refresh this dashboard to see updated prices</li>
            </ol>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <div className="font-semibold text-slate-700 mb-2">📡 API Endpoints</div>
          <p className="mt-1">
            <span className="font-mono text-slate-800">GET /api/manual/foodex</span> → returns{' '}
            <span className="font-mono">{'{ id, url, selector, productName }'}</span> for every Foodex product.
          </p>
          <p className="mt-1">
            <span className="font-mono text-slate-800">POST /api/manual/foodex</span> → send{' '}
            <span className="font-mono">{'{ entries: [{ id, unitPrice, packPrice?, packSize? }] }'}</span> to store new
            snapshots.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a className={linkButton} href="https://foodex.london/login" target="_blank" rel="noreferrer">
            Open Foodex login
          </a>
          <a className={linkButton} href="/api/manual/foodex" target="_blank" rel="noreferrer">
            View product feed
          </a>
        </div>

        <p className="mt-4 text-xs text-slate-500">
          💡 <span className="font-semibold">Tip:</span> You only need to log in to Foodex once per session. The extension will reuse your cookies for all subsequent scrapes.
        </p>
      </div>
    </div>
  );
}
