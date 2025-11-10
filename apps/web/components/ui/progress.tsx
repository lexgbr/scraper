export default function Progress({ value=0 }: { value?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
      <div
        className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
