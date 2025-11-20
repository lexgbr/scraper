import './globals.css';
import SidebarNav from '../components/sidebar-nav';

export const metadata = {
  title: 'MarionTrading Scraping Tool',
  description: 'Operational console for MarionTrading price monitoring.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -left-24 top-[-140px] h-[420px] w-[420px] rounded-full bg-indigo-200/50 blur-3xl" />
            <div className="absolute right-[-120px] top-1/3 h-[360px] w-[360px] rounded-full bg-sky-200/40 blur-3xl" />
            <div className="absolute bottom-[-180px] left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-slate-200/40 blur-[140px]" />
          </div>
          <div className="flex max-w-7xl flex-col gap-8 px-4 py-10 lg:flex-row lg:px-8">
            <SidebarNav />
            <main className="flex-1 space-y-6 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-xl shadow-slate-200/70 backdrop-blur">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
