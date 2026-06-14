import { CheckCircle2, MapPin, Navigation, Package, RefreshCw, Route } from "lucide-react";
import { DeliveryTrip, TripStop } from "@/lib/deliveryTripService";
import { DeliveryMap, MapStop } from "./DeliveryMap";

export const TripView = ({
  trip,
  rider,
  onConfirmPickup,
  onOpenStop,
  onReoptimize,
  busy,
}: {
  trip: DeliveryTrip;
  rider: { latitude: number; longitude: number } | null;
  onConfirmPickup: () => void;
  onOpenStop: (stop: TripStop) => void;
  onReoptimize: () => void;
  busy?: boolean;
}) => {
  const mapStops: MapStop[] = trip.stops.map((s) => ({
    latitude: s.latitude,
    longitude: s.longitude,
    type: s.type,
    label: s.label,
    sequence: s.sequence,
    is_completed: s.is_completed,
  }));

  const dropoffs = trip.stops.filter((s) => s.type === "dropoff");
  const doneCount = dropoffs.filter((s) => s.is_completed).length;
  const awaitingPickup = trip.status === "ASSIGNED";

  return (
    <div className="space-y-4">
      <DeliveryMap stops={mapStops} polyline={trip.encoded_polyline} rider={rider} className="h-56" />

      <div className="flex items-center justify-between rounded-3xl glass p-4 shadow-card-soft">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            <Route className="h-3.5 w-3.5" /> Optimized route
          </div>
          <div className="mt-0.5 text-lg font-extrabold text-foreground">
            {dropoffs.length} stops · {Number(trip.total_distance_km).toFixed(1)} km
          </div>
          <div className="text-xs text-muted-foreground">
            ~{trip.total_duration_min} min · {doneCount}/{dropoffs.length} delivered
          </div>
        </div>
        <button
          onClick={onReoptimize}
          disabled={busy}
          className="grid h-10 w-10 place-items-center rounded-2xl bg-card ring-1 ring-border disabled:opacity-50"
          aria-label="Re-optimize route"
        >
          <RefreshCw className={`h-4 w-4 text-foreground ${busy ? "animate-spin" : ""}`} />
        </button>
      </div>

      {awaitingPickup && (
        <button
          onClick={onConfirmPickup}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-amber px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-glow-amber disabled:opacity-60"
        >
          <Package className="h-4 w-4" /> Confirm hub pickup ({dropoffs.length} orders)
        </button>
      )}

      <div className="space-y-2">
        {trip.stops.map((s, i) => {
          const isPickup = s.type === "pickup";
          const done = s.is_completed;
          const clickable = !isPickup && trip.status === "ACTIVE" && !done;
          return (
            <div
              key={s.id}
              className={`flex items-stretch gap-3 rounded-2xl bg-card p-3 shadow-card-soft ring-1 ring-border ${
                done ? "opacity-60" : ""
              } ${clickable ? "cursor-pointer hover:ring-primary/40" : ""}`}
              onClick={clickable ? () => onOpenStop(s) : undefined}
            >
              <div className="flex flex-col items-center pl-1">
                <div
                  className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-extrabold ${
                    isPickup ? "bg-gradient-amber text-accent-foreground" : "bg-primary-soft text-primary"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : isPickup ? "H" : i}
                </div>
                {i < trip.stops.length - 1 && <div className="mt-1 w-0.5 flex-1 bg-border" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      isPickup ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {isPickup ? "Pickup" : `Drop ${i}`}
                  </span>
                  {s.customer && <span className="truncate text-xs text-muted-foreground">{s.customer}</span>}
                </div>
                <div className="mt-1 truncate text-sm font-bold text-foreground">{s.label}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> <span className="truncate">{s.address}</span>
                </div>
              </div>
              {clickable && (
                <div className="flex items-center pr-1 text-primary">
                  <Navigation className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
