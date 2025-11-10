'use client';
import { useEffect, useMemo, useState } from 'react';
import Card from '../components/ui/card';
import Button from '../components/ui/button';
import Progress from '../components/ui/progress';
import Badge from '../components/ui/badge';

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
  items: number;
  updated?: string | null;
};

export default function Home() {
  const [status, setStatus] = useState<HomeStatus | null>(null);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);

  const refresh = async () => {
    const response = await fetch('/api/home');
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

  const runNow = async () => {
    try {
      setIsTriggering(true);
      await fetch('/api/run', { method: 'POST' });
      await refresh();
    } finally {
      setIsTriggering(false);
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Monitor price updates across all connected marketplaces and trigger a fresh scrape whenever you need.
          </p>
        </div>
        <Button onClick={runNow} disabled={isTriggering || status?.status === 'running'}>
          {status?.status === 'running' ? 'Scraper running...' : 'Run scraper'}
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
              <h2 className="text-xl font-semibold text-slate-900">Lists overview</h2>
            </div>
            <span className="text-sm font-medium text-indigo-600">{lists.length} active</span>
          </div>
          <div className="grid gap-3">
            {lists.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
                No lists yet. Add a product to get started.
              </div>
            )}
            {lists.map((list, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-indigo-100/70 bg-white/80 p-4 shadow-sm shadow-indigo-100/40"
              >
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                  {list.site}
                  <span className="text-xs font-medium text-indigo-500">{list.items} products</span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Last check: {list.updated ? new Date(list.updated).toLocaleString() : 'No data yet'}
                </div>
              </div>
            ))}
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
                      {f.old} -> {f.new} GBP @ {new Date(f.changedAt).toLocaleString()}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
