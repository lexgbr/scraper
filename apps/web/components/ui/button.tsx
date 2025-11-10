import { cn } from '../utils';

type Variant = 'primary' | 'ghost' | 'danger';

export default function Button(
  { className, variant = 'primary', ...p }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
) {
  const base =
    'btn-ripple inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60';

  const variants: Record<Variant, string> = {
    primary:
      'border-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 text-white shadow-md shadow-indigo-200/60 hover:-translate-y-0.5 hover:shadow-lg',
    ghost:
      'border-slate-200/70 bg-white/60 text-indigo-600 backdrop-blur-sm hover:bg-white hover:text-indigo-700',
    danger:
      'border-transparent bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white shadow-md shadow-rose-200/70 hover:-translate-y-0.5 hover:shadow-lg',
  };

  return <button {...p} className={cn(base, variants[variant], className)} />;
}
