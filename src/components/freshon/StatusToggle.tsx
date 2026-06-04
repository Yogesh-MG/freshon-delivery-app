import { useRef, useState } from "react";
import { Power, Zap } from "lucide-react";

export const StatusToggle = ({ online, onChange }: { online: boolean; onChange: (v: boolean) => void }) => {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const idRef = useRef(0);

  const fire = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const id = ++idRef.current;
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 900);
    onChange(!online);
  };

  return (
    <button
      onClick={fire}
      className={`relative w-full overflow-hidden rounded-3xl p-5 text-left transition-all duration-500
        ${online
          ? "bg-gradient-primary text-primary-foreground shadow-glow-primary animate-glow-pulse"
          : "glass-dark text-primary-foreground"}`}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 animate-ripple"
          style={{ left: r.x, top: r.y }}
        />
      ))}
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80">
            {online ? <Zap className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            {online ? "Online · Accepting Missions" : "Offline"}
          </div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight">
            {online ? "You're on the grid" : "Tap to Go Online"}
          </div>
          <div className="mt-1 text-sm opacity-80">
            Zone <span className="font-semibold">Midtown North</span> · Demand{" "}
            <span className={`font-semibold ${online ? "text-accent-glow" : "text-accent"}`}>High</span>
          </div>
        </div>
        <div className={`grid h-14 w-14 place-items-center rounded-full transition-all
          ${online ? "bg-white/20" : "bg-white/10"}`}>
          <div className={`h-3 w-3 rounded-full ${online ? "bg-accent shadow-glow-amber animate-amber-pulse" : "bg-white/50"}`} />
        </div>
      </div>
    </button>
  );
};
