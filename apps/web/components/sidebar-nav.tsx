'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiUrl } from '../lib/api';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/products', label: 'Products' },
  { href: '/pricelists', label: 'Price Lists' },
  { href: '/settings', label: 'Credentials' },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <aside className="w-64 shrink-0 rounded-3xl border border-white/70 bg-white/95 p-6 shadow-lg shadow-slate-200/70 backdrop-blur">
      <div className="mb-7 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-100">
          MarionTrading
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] text-white">Live</span>
        </div>
        <div className="text-2xl font-semibold text-slate-900">Scraping Control Center</div>
        <p className="text-sm text-slate-500">
          Monitor daily supplier checks, maintain product coverage, and keep credentials up to date.
        </p>
      </div>
      <nav className="flex flex-col gap-2 text-sm font-semibold">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                'rounded-2xl px-3 py-2 transition',
                active
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-300/70'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              {link.label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="mt-4 rounded-2xl px-3 py-2 text-left text-red-600 transition hover:bg-red-50"
        >
          Logout
        </button>
      </nav>
    </aside>
  );
}
