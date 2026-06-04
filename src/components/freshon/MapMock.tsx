import { MapPin, Navigation2 } from "lucide-react";
import { useEffect, useState } from "react";

// Mock GPS that nudges the marker every 5s along a fake path
const path = [
  { x: 18, y: 78 }, { x: 28, y: 70 }, { x: 36, y: 60 },
  { x: 48, y: 52 }, { x: 60, y: 44 }, { x: 72, y: 32 }, { x: 82, y: 22 },
];

export const MapMock = ({ compact = false }: { compact?: boolean }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % path.length), 2500);
    return () => clearInterval(t);
  }, []);
  const pos = path[i];

  const polyline = path.map((p) => `${p.x},${p.y}`).join(" ");
  const stops = [path[0], path[3], path[5], path[6]];

  return (
    <div className={`relative overflow-hidden rounded-3xl map-grid shadow-card-soft ${compact ? "h-44" : "h-72"}`}>
      {/* river */}
      <div className="absolute inset-x-0 top-1/3 h-10 -rotate-3 bg-primary/10 blur-sm" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <polyline points={polyline} fill="none" stroke="hsl(var(--secondary) / 0.3)" strokeWidth="1.4" strokeLinecap="round" />
        <polyline points={polyline} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.9" strokeLinecap="round" className="animate-route" />
        {stops.map((s, idx) => (
          <circle key={idx} cx={s.x} cy={s.y} r="1.6" fill={idx === 0 ? "hsl(var(--accent))" : "hsl(var(--primary))"} stroke="white" strokeWidth="0.6" />
        ))}
      </svg>

      {/* Driver marker */}
      <div
        className="absolute transition-all duration-[2400ms] ease-linear"
        style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
      >
        <div className="relative grid h-10 w-10 place-items-center">
          <div className="absolute inset-0 rounded-full bg-primary/30 animate-radar" />
          <div className="relative grid h-9 w-9 place-items-center rounded-full bg-gradient-primary shadow-glow-primary">
            <Navigation2 className="h-4 w-4 -rotate-12 text-primary-foreground" />
          </div>
        </div>
      </div>

      {/* Top overlay */}
      <div className="absolute inset-x-3 top-3 flex items-center justify-between rounded-2xl glass px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" /> Live route
        </div>
        <div className="text-muted-foreground">ETA <span className="font-bold text-foreground">22 min</span> · 6.2 km</div>
      </div>
    </div>
  );
};
