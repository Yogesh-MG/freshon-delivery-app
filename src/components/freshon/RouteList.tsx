import { Assignment, Stop } from "@/lib/types";
import { CheckCircle2, ChevronRight, GripVertical, MapPin, Package } from "lucide-react";
import { useEffect, useState } from "react";

export const RouteList = ({
  mission,
  completedStopIds,
  onOpenStop,
  onPickup,
}: {
  mission: Assignment;
  completedStopIds: Set<string>;
  onOpenStop: (s: Stop) => void;
  onPickup: (s: Stop) => void;
}) => {
  const [stops, setStops] = useState(mission.stops);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    setStops(mission.stops);
  }, [mission.id, mission.stops]);

  const handleDrop = (id: string) => {
    if (!dragId || dragId === id) return;
    const from = stops.findIndex((s) => s.id === dragId);
    const to = stops.findIndex((s) => s.id === id);
    const next = [...stops];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    setStops(next);
    setDragId(null);
  };

  return (
    <div className="space-y-2">
      {stops.map((s, i) => {
        const done = completedStopIds.has(s.id);
        const isPickup = s.type === "pickup";
        return (
          <div
            key={s.id}
            draggable
            onDragStart={() => setDragId(s.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(s.id)}
            className={`group relative flex items-stretch gap-3 rounded-2xl bg-card p-3 shadow-card-soft ring-1 ring-border transition-all
              ${dragId === s.id ? "scale-[1.02] ring-primary" : "hover:ring-primary/40"}
              ${done ? "opacity-60" : ""}`}
          >
            <div className="flex flex-col items-center pl-1">
              <div className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-extrabold
                ${isPickup ? "bg-gradient-amber text-accent-foreground" : "bg-primary-soft text-primary"}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < stops.length - 1 && <div className="mt-1 w-0.5 flex-1 bg-border" />}
            </div>
            <button onClick={() => onOpenStop(s)} className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider
                  ${isPickup ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"}`}>
                  {isPickup ? "Pickup" : "Drop"}
                </span>
                <span className="text-xs text-muted-foreground">ETA {s.eta}</span>
              </div>
              <div className="mt-1 truncate text-sm font-bold text-foreground">{s.label}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> <span className="truncate">{s.address}</span>
              </div>
            </button>
            <div className="flex flex-col items-center justify-between pr-1">
              <GripVertical className="h-4 w-4 text-muted-foreground/60" />
              {!done && !isPickup && (
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenStop(s); }}
                  className="rounded-lg p-1.5 text-primary hover:bg-primary-soft"
                  aria-label="Complete stop"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              {isPickup && !done && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPickup(s); }}
                  className="rounded-lg p-1.5 text-accent hover:bg-accent/15"
                  aria-label="Confirm pickup"
                >
                  <Package className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
