import './globals.css';
import SidebarNav from '../components/sidebar-nav';

export const metadata = { title: 'Demo' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body className="min-h-screen text-slate-900">
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -left-36 top-[-180px] h-96 w-96 rounded-full bg-indigo-300/40 blur-3xl" />
            <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-purple-300/40 blur-3xl" />
            <div className="absolute bottom-[-160px] left-1/3 h-96 w-96 rounded-full bg-rose-200/30 blur-3xl" />
          </div>
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 lg:flex-row lg:px-6">
            <SidebarNav />
            <main className="flex-1 space-y-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
