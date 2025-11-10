import { cn } from '../utils';


export default function Badge({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) {
  const base =
    'inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600';
  return <span {...p} className={cn(base, className)} />;
}
