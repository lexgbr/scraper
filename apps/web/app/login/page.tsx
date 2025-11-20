'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '../../components/ui/card';
import Button from '../../components/ui/button';
import { apiUrl } from '../../lib/api';

const inputClass =
  'w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm shadow-indigo-100/40 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-[-140px] h-[420px] w-[420px] rounded-full bg-indigo-200/50 blur-3xl" />
        <div className="absolute right-[-120px] top-1/3 h-[360px] w-[360px] rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-[-180px] left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-slate-200/40 blur-[140px]" />
      </div>

      <Card className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-100">
            MarionTrading
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] text-white">Live</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Scraping Control Center</h1>
          <p className="text-sm text-slate-500">Sign in to access the dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              className={inputClass}
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={inputClass}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-xs text-center text-slate-500">
          Contact your administrator if you need access
        </p>
      </Card>
    </div>
  );
}
