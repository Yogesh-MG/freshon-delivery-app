import { EarningsStats } from "@/lib/types";
import { Star, TrendingUp } from "lucide-react";

export const EarningsHeader = ({ stats }: { stats: EarningsStats }) => {
  const { earnings, goal, deliveries, distance, rating } = stats;
  const pct = goal > 0 ? Math.min(100, (earnings / goal) * 100) : 0;
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="glass rounded-3xl p-5 shadow-card-soft">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
            <circle cx="36" cy="36" r={r} stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
            <circle
              cx="36" cy="36" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
              stroke="url(#g)" strokeDasharray={c} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s ease" }}
            />
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--primary-glow))" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-[11px] font-bold text-primary">{Math.round(pct)}%</div>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Today's Earnings</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <div className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">₹{earnings.toFixed(2)}</div>
            <div className="text-xs tabular-nums text-muted-foreground">/ ₹{goal}</div>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-primary" /> {deliveries} drops</span>
            <span>{distance} km</span>
            <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" /> {rating}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
