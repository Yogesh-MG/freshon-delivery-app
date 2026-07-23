import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, IndianRupee, Loader2, MapPin, Navigation, RefreshCw, Route, X } from "lucide-react";
import { DeliveryTrip, TripStop } from "@/lib/deliveryTripService";
import { openInGoogleMaps } from "@/lib/mapApps";
import { BagScanFlow } from "./BagScanFlow";
import { DeliveryMap, MapStop } from "./DeliveryMap";
import { RouteToggle, RouteDest } from "./RouteToggle";

export const TripView = ({
  trip,
  rider,
  onConfirmPickup,
  onTripUpdate,
  onOpenStop,
  onReoptimize,
  onCancel,
  onRefreshPosition,
  busy,
}: {
  trip: DeliveryTrip;
  rider: { latitude: number; longitude: number } | null;
  /** Re-sample the rider's GPS. Called when the map destination is toggled so
   *  the drawn leg starts from where they are now, not where they were. */
  onRefreshPosition?: () => void;
  onConfirmPickup: () => void;
  onTripUpdate: (trip: DeliveryTrip) => void;
  onOpenStop: (stop: TripStop) => void;
  onReoptimize: () => void;
  onCancel?: () => Promise<void>;
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


  /**
   * Where the external Google Maps hand-off points. Gated on the hub handover:
   * every bag must be scanned before navigation will take the rider onward, so
   * nobody leaves the hub with an unaccounted bag.
   */
  const allBagsScanned = dropoffs.length > 0 && dropoffs.every((s) => s.bag_scanned);
  const navDest: RouteDest = awaitingPickup && !allBagsScanned ? "hub" : "dropoff";

  // What the on-screen map draws — the rider's own choice, so they can preview
  // the drop-off route while still scanning at the hub. Follows `navDest` by
  // default and re-syncs whenever the gate opens or the trip changes.
  const [mapDest, setMapDest] = useState<RouteDest>(navDest);
  useEffect(() => {
    setMapDest(navDest);
  }, [navDest, trip.id]);

  // Re-fix the origin whenever the drawn leg flips. Held in a ref because the
  // parent passes an inline callback — a new identity every render would re-fire
  // this endlessly.
  const refreshRef = useRef(onRefreshPosition);
  refreshRef.current = onRefreshPosition;
  useEffect(() => {
    refreshRef.current?.();
  }, [mapDest]);

  const hubStop: MapStop | null =
    trip.hub?.latitude != null && trip.hub?.longitude != null
      ? {
          latitude: trip.hub.latitude,
          longitude: trip.hub.longitude,
          type: "pickup",
          label: trip.hub.label || "Hub",
          sequence: 0,
        }
      : null;

  // In hub mode drop the optimized polyline entirely — it describes the whole
  // trip, not the leg the rider asked for, and drawing both is just noise.
  const shownStops = mapDest === "hub" ? (hubStop ? [hubStop] : []) : mapStops;
  const shownPolyline = mapDest === "hub" ? undefined : trip.encoded_polyline;

  // Hand-off to Google Maps / Waze follows the SAME toggle as the in-app map, so
  // whichever leg the rider is looking at is the leg that opens externally.
  const handleNavigate = () => {
    // The rider's own position is the origin. When it's unknown we pass null
    // rather than substituting the hub — every map app falls back to the live
    // device location, which beats a guessed origin (and routing hub → hub is
    // meaningless).
    const origin = rider ? { lat: rider.latitude, lng: rider.longitude } : null;

    if (navDest === "hub") {
      if (!hubStop) return;
      openInGoogleMaps({
        origin,
        destination: { lat: hubStop.latitude!, lng: hubStop.longitude! },
      });
      return;
    }

    const remaining = dropoffs
      .filter((s) => !s.is_completed && s.latitude != null && s.longitude != null)
      .sort((a, b) => a.sequence - b.sequence);
    if (remaining.length === 0) return;

    // Google Maps takes the full chain: origin → waypoints → final destination,
    // in the backend's optimized order. Waze and the generic geo: intent only
    // support a single destination and ignore the waypoints (see buildMapUrl).
    const dest = remaining[remaining.length - 1];
    openInGoogleMaps({
      origin,
      destination: { lat: dest.latitude!, lng: dest.longitude! },
      waypoints: remaining.slice(0, -1).map((s) => ({ lat: s.latitude!, lng: s.longitude! })),
    });
  };

  const canNavigate =
    navDest === "hub"
      ? !!hubStop
      : dropoffs.some((s) => !s.is_completed && s.latitude != null && s.longitude != null);

  return (
    <div>
      <DeliveryMap stops={shownStops} polyline={shownPolyline} rider={rider} enableLocate className="h-56" />

      <div className="px-5 pt-3">
        <RouteToggle
          value={mapDest}
          onChange={setMapDest}
          hubEnabled={!!hubStop}
          dropoffEnabled={dropoffs.length > 0}
          dropoffLabel="Stops"
        />
      </div>

      <div className="space-y-4 px-5 pt-4">
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
          {trip.earnings != null && (
            <div className="mt-1 flex items-center gap-1 text-sm font-bold text-primary">
              <IndianRupee className="h-3.5 w-3.5" />
              {Number(trip.earnings).toFixed(2)} earned this trip
            </div>
          )}
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

      <button
        onClick={handleNavigate}
        disabled={!canNavigate}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1a73e8] px-5 py-3.5 text-sm font-bold text-white shadow-md disabled:opacity-40"
        aria-label="Open in Google Maps"
      >
        <ExternalLink className="h-4 w-4" />
        {navDest === "hub" ? "Navigate to Hub" : "Navigate Deliveries"}
      </button>

      {awaitingPickup && (
        <BagScanFlow
          trip={trip}
          onTripUpdate={onTripUpdate}
          onAllScanned={onConfirmPickup}
          busy={busy}
        />
      )}

      {awaitingPickup && onCancel && (
        <CancelTripButton onCancel={onCancel} busy={busy} />
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
    </div>
  );
};

const CancelTripButton = ({ onCancel, busy }: { onCancel: () => Promise<void>; busy?: boolean }) => {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-50 px-5 py-3 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400 disabled:opacity-50"
      >
        <X className="h-4 w-4" /> Cancel Trip
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-red-400/30 bg-red-50 p-4 dark:bg-red-500/10">
      <p className="mb-3 text-center text-sm font-semibold text-red-700 dark:text-red-400">
        Cancel this trip? It will be returned to the pool.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-bold text-foreground"
        >
          Keep trip
        </button>
        <button
          onClick={async () => { setCancelling(true); await onCancel(); setCancelling(false); }}
          disabled={cancelling}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-70"
        >
          {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          Yes, cancel
        </button>
      </div>
    </div>
  );
};
