import { Assignment } from "@/lib/types";

export const FeeBreakdown = ({ mission }: { mission: Assignment }) => {
  const { fee } = mission;
  const total = fee.weight + fee.distance + fee.premium;
  const rows = [
    { label: "Weight", value: fee.weight, hint: `${mission.weight_kg}kg`, color: "bg-primary" },
    { label: "Distance", value: fee.distance, hint: `${mission.distance_km}km`, color: "bg-primary-glow" },
    { label: "Swift Premium", value: fee.premium, hint: "Priority dispatch", color: "bg-accent" },
  ];
  return (
    <div className="rounded-3xl glass p-4 shadow-card-soft">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Fee Engine</div>
          <div className="text-xs text-muted-foreground">Weight + Distance + Swift</div>
        </div>
        <div className="text-xl font-extrabold text-foreground">₹{total.toFixed(2)}</div>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">{r.label} <span className="ml-1 font-normal text-muted-foreground">{r.hint}</span></span>
              <span className="font-bold tabular-nums text-foreground">₹{r.value.toFixed(2)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${r.color}`} style={{ width: total > 0 ? `${(r.value / total) * 100}%` : "0%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
