/**
 * `value` is kilograms. Null means no item on the load reported a weight — say
 * so rather than drawing an empty bar, which reads as "nothing to carry".
 */
export const LoadMeter = ({ value, capacity }: { value: number | null; capacity: number }) => {
  const known = value != null;
  const pct = known ? Math.min(100, (value / capacity) * 100) : 0;
  return (
    <div className="rounded-3xl glass p-4 shadow-card-soft">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Vehicle Load</div>
          <div className="mt-0.5 text-lg font-extrabold tabular-nums text-foreground">
            {known ? `${value.toFixed(1)} / ${capacity} kg` : `— / ${capacity} kg`}
          </div>
        </div>
        <div className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold tabular-nums text-primary">
          {known ? `${Math.round(pct)}% full` : "Weight n/a"}
        </div>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-primary transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};
