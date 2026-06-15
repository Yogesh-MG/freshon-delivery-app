import { Assignment } from "@/lib/types";
import { ArrowRight, MapPin, Package, Zap } from "lucide-react";
import { useState } from "react";

const serviceMeta = {
  swift: { label: "Swift", className: "bg-gradient-amber text-accent-foreground shadow-glow-amber", icon: Zap },
  "next-day": { label: "Next Day", className: "bg-primary-soft text-primary", icon: Package },
  standard: { label: "Standard", className: "bg-muted text-secondary", icon: Package },
} as const;

export const MissionCard = ({ mission, onAccept }: { mission: Assignment; onAccept: () => Promise<void> | void }) => {
  const meta = serviceMeta[mission.service];
  const Icon = meta.icon;
  const [accepting, setAccepting] = useState(false);
  const pickup = mission.stops.find((stop) => stop.type === "pickup");
  const dropCount = mission.stops.filter((stop) => stop.type === "dropoff").length;

  const handle = async () => {
    setAccepting(true);
    await onAccept();
    setAccepting(false);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-slate p-5 text-primary-foreground shadow-elevated animate-slide-up">
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-accent/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${meta.className}`}>
            <Icon className="h-3.5 w-3.5" /> {meta.label}
          </span>
          <span className="text-xs opacity-70">Mission {mission.id}</span>
        </div>
        <div className="mt-3 text-sm opacity-80">New assignment</div>
        <div className="text-2xl font-extrabold leading-tight">{pickup?.label || "Pickup"} to {dropCount} drops</div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Earnings" value={`₹${Number(mission.earnings).toFixed(2)}`} accent />
          <Stat label="Distance" value={`${mission.distance_km} km`} />
          <Stat label="Weight" value={`${mission.weight_kg} kg`} />
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs opacity-80">
          <MapPin className="h-3.5 w-3.5 text-accent" /> Pickup ETA {pickup?.eta || "soon"}
        </div>

        <button
          onClick={handle}
          disabled={accepting}
          className={`group relative mt-5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-amber px-5 py-4 text-sm font-bold text-accent-foreground shadow-glow-amber transition-all disabled:opacity-80
            ${accepting ? "scale-[1.02]" : "hover:scale-[1.01] active:scale-[0.99]"}`}
        >
          <span className={`absolute inset-0 bg-white/30 transition-transform duration-500 ${accepting ? "scale-x-100" : "scale-x-0"}`} style={{ transformOrigin: "left" }} />
          <span className="relative">{mission.status === "PENDING" ? "Accept Mission" : "Open Mission"}</span>
          <ArrowRight className={`relative h-4 w-4 transition-transform ${accepting ? "translate-x-2" : "group-hover:translate-x-1"}`} />
        </button>
      </div>
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
    <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    <div className={`text-lg font-extrabold ${accent ? "text-accent-glow" : ""}`}>{value}</div>
  </div>
);
