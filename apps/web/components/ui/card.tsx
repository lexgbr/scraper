import { cn } from '../utils';

export default function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  const base =
    'group relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm shadow-indigo-100 backdrop-blur';
  return <div {...p} className={cn(base, className)} />;
}
