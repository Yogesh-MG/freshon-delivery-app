export const LoadMeter = ({ value, capacity }: { value: number; capacity: number }) => {
  const pct = Math.min(100, (value / capacity) * 100);
  return (
    <div className="rounded-3xl glass p-4 shadow-card-soft">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Vehicle Load</div>
          <div className="text-lg font-extrabold text-foreground">{value} / {capacity} kg</div>
        </div>
        <div className="text-xs font-semibold text-primary">{Math.round(pct)}% full</div>
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
