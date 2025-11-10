'use client';
import { useEffect, useState } from 'react';
import type { SiteId } from '../../../../config/sites';
import { SITE_DEFINITIONS, SITE_BY_ID } from '../../../../config/sites';
import Card from '../../components/ui/card';
import Button from '../../components/ui/button';

type CredView = { username?: string; hasPassword?: boolean; hasTotp?: boolean };

const inputClass =
  'w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm shadow-indigo-100/40 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100';

export default function SettingsPage() {
  const [view, setView] = useState<Record<string, CredView>>({});
  const [activeSite, setActiveSite] = useState<SiteId>('romprod');
  const [form, setForm] = useState({ siteId: 'romprod', username: '', password: '', totpSecret: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    setView(data.creds || {});
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setForm((prev) => {
      const stored = view[activeSite];
      return {
        ...prev,
        siteId: activeSite,
        username: stored?.username ?? '',
        password: '',
        totpSecret: '',
      };
    });
  }, [activeSite, view]);

  const save = async () => {
    setIsSubmitting(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      await load();
      setForm((prev) => ({ ...prev, password: '', totpSecret: '' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSite = SITE_BY_ID.get(activeSite);
  const currentStatus = view[activeSite];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Store the site credentials locally so the scraper can log in securely for each integration.
        </p>
      </div>

      <Card className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {SITE_DEFINITIONS.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => setActiveSite(site.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                activeSite === site.id
                  ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-300'
                  : 'bg-white/80 text-slate-500 hover:text-indigo-600'
              }`}
            >
              {site.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {currentSite?.name ?? 'Site'} credentials
          </h2>
          <p className="text-sm text-slate-500">
            Update the account used for scraping. Passwords are stored on disk and reused for automated logins.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <input
            className={inputClass}
            placeholder="Username or email"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <input
            className={inputClass}
            placeholder="TOTP secret (optional)"
            value={form.totpSecret}
            onChange={(event) => setForm({ ...form, totpSecret: event.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            {currentStatus?.username ? (
              <>
                Active user:{' '}
                <span className="font-semibold text-slate-800">{currentStatus.username}</span>
                {currentStatus.hasPassword ? ' - password stored' : ' - password missing'}
                {currentStatus.hasTotp ? ' - TOTP enabled' : ''}
              </>
            ) : (
              'Not configured yet.'
            )}
          </div>
          <Button onClick={save} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="space-y-2 text-sm text-slate-500">
          <div className="font-medium text-slate-700">Storage details</div>
          <p>
            Credentials live inside <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.state/creds.json</code>.
            The scraper reads them at runtime and never sends them elsewhere.
          </p>
        </div>
      </Card>
    </div>
  );
}
