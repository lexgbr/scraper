'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Homepage' },
  { href: '/products', label: 'Product List' },
  { href: '/pricelists', label: 'Price Lists' },
  { href: '/settings', label: 'Settings' },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-sm shadow-indigo-100 backdrop-blur">
      <div className="mb-6 space-y-2">
        <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-600">
          Demo
        </span>
        <div className="text-xl font-semibold text-slate-900">Scraper Demo</div>
        <p className="text-sm text-slate-500">
          Manage products and credentials across all supported marketplaces.
        </p>
      </div>
      <nav className="flex flex-col gap-2 text-sm font-medium">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                'rounded-2xl px-3 py-2 transition',
                active
                  ? 'bg-gradient-to-r from-indigo-500/90 to-purple-500/90 text-white shadow-sm shadow-indigo-200'
                  : 'text-slate-600 hover:bg-white hover:text-indigo-600',
              ].join(' ')}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
