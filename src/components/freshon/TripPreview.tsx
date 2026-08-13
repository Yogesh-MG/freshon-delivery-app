import { useState } from "react";
import {
    ArrowRight,
    Boxes,
    Clock,
    IndianRupee,
    Loader2,
    MapPin,
    Navigation,
    Package,
    Route,
    Store,
    X,
} from "lucide-react";
import { DeliveryTrip } from "@/lib/deliveryTripService";
import { TripDistance, stopWeightKg, tripParcelCount, tripWeightKg } from "@/lib/tripDistance";

/**
 * Everything about an offered trip, before committing to it. The pool cards
 * carry only the headline numbers; a rider deciding whether a fare is worth
 * taking needs the addresses, the load and where the distance actually goes —
 * and shouldn't have to accept the trip to find out.
 */
export const TripPreview = ({
    trip,
    distance,
    busy,
    onAccept,
    onClose,
}: {
    trip: DeliveryTrip;
    distance: TripDistance;
    busy?: boolean;
    onAccept: (trip: DeliveryTrip) => void;
    onClose: () => void;
}) => {
    const [accepting, setAccepting] = useState(false);
    const dropoffs = trip.stops.filter((s) => s.type === "dropoff").sort((a, b) => a.sequence - b.sequence);
    const weightKg = tripWeightKg(trip);
    const parcels = tripParcelCount(trip);
    const isBatch = dropoffs.length > 1;

    const accept = () => {
        setAccepting(true);
        onAccept(trip);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-label="Trip details">
            <div className="absolute inset-0 bg-secondary/40 backdrop-blur-sm animate-fade-up" onClick={onClose} />
            <div className="relative z-10 flex max-h-[88vh] w-full max-w-md flex-col rounded-t-[28px] bg-card shadow-elevated animate-slide-up">
                <div className="flex justify-center pt-3"><div className="h-1.5 w-12 rounded-full bg-border" /></div>

                <div className="flex items-start justify-between gap-3 px-5 pt-2">
                    <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-foreground">
                            <Package className="h-3 w-3" /> {isBatch ? `Batch · ${dropoffs.length} stops` : "Single order"}
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-0.5">
                            <IndianRupee className="h-5 w-5 self-center text-primary" />
                            <span className="text-4xl font-black leading-none text-primary">
                                {trip.earnings != null ? Number(trip.earnings).toFixed(0) : "—"}
                            </span>
                            <span className="ml-1 text-xs text-muted-foreground">estimated</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted tap-target" aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4 no-scrollbar">
                    {/* Distance breakdown — the whole point of the preview: where the
              kilometres actually go, including the ride to the hub. */}
                    <div className="rounded-2xl bg-muted/60 p-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                            Distance you'll ride
                        </div>
                        <div className="mt-2 space-y-1.5 text-sm">
                            <Leg
                                icon={<Navigation className="h-3.5 w-3.5" />}
                                label="You → Hub"
                                value={distance.approachKm != null ? `${distance.approachKm.toFixed(1)} km` : "—"}
                                muted={distance.estimated}
                            />
                            <Leg
                                icon={<Route className="h-3.5 w-3.5" />}
                                label={`Hub → ${dropoffs.length} ${dropoffs.length === 1 ? "drop" : "drops"}`}
                                value={`${distance.routeKm.toFixed(1)} km`}
                            />
                            <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
                                <span className="text-sm font-extrabold text-foreground">Total</span>
                                <span className="text-lg font-black text-primary">{distance.totalKm.toFixed(1)} km</span>
                            </div>
                        </div>
                        {distance.estimated && distance.approachKm != null && (
                            <div className="mt-1.5 text-[11px] text-muted-foreground">
                                Hub leg is a straight-line estimate — refining…
                            </div>
                        )}
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2.5">
                        <Metric icon={<Clock className="h-4 w-4" />} label="Est. time" value={`~${trip.total_duration_min} min`} />
                        <Metric
                            icon={<Package className="h-4 w-4" />}
                            label="Total load"
                            value={weightKg != null ? `${weightKg.toFixed(2)} kg` : "—"}
                        />
                        <Metric
                            icon={<Boxes className="h-4 w-4" />}
                            label={parcels === 1 ? "Parcel" : "Parcels"}
                            value={parcels != null ? String(parcels) : "—"}
                        />
                    </div>

                    {trip.hub && (
                        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                                <Store className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-accent">Pick up from</div>
                                <div className="truncate text-sm font-bold text-foreground">{trip.hub.label}</div>
                                <div className="text-xs text-muted-foreground">{trip.hub.address}</div>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        {dropoffs.length === 1 ? "Drop-off" : `${dropoffs.length} drop-offs · optimized order`}
                    </div>
                    <div className="space-y-2">
                        {dropoffs.map((stop, i) => {
                            const stopKg = stopWeightKg(stop);
                            return (
                                <div key={stop.id} className="flex items-stretch gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
                                    <div className="flex flex-col items-center">
                                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-xs font-extrabold text-primary">
                                            {i + 1}
                                        </div>
                                        {i < dropoffs.length - 1 && <div className="mt-1 w-0.5 flex-1 bg-border" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="truncate text-sm font-bold text-foreground">
                                                {stop.order_id || stop.label}
                                            </span>
                                            {stop.eta && <span className="shrink-0 text-[11px] text-muted-foreground">{stop.eta}</span>}
                                        </div>
                                        <div className="flex items-start gap-1 text-xs text-muted-foreground">
                                            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                                            {/* Addresses come through with embedded newlines. */}
                                            <span className="line-clamp-2 whitespace-pre-line">{stop.address}</span>
                                        </div>

                                        {/* Load line. The live payload has no item manifest, so
                        weight + parcel count is what the rider gets. */}
                                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
                                            {stopKg != null && (
                                                <span className="flex items-center gap-1 font-bold text-foreground">
                                                    <Package className="h-3 w-3 text-primary" /> {stopKg.toFixed(2)} kg
                                                </span>
                                            )}
                                            {stop.parcel_count != null && stop.parcel_count > 0 && (
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <Boxes className="h-3 w-3" /> {stop.parcel_count}{" "}
                                                    {stop.parcel_count === 1 ? "parcel" : "parcels"}
                                                </span>
                                            )}
                                            {stop.order_id && (
                                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                                    {stop.order_id}
                                                </span>
                                            )}
                                        </div>

                                        {stop.items && stop.items.length > 0 && (
                                            <div className="mt-1.5 space-y-0.5">
                                                {stop.items.map((item, n) => (
                                                    <div key={n} className="flex items-center justify-between gap-2 text-[11px]">
                                                        <span className="truncate text-foreground">
                                                            {item.qty}× {item.name}
                                                            {item.fragile && (
                                                                <span className="ml-1 rounded bg-accent/15 px-1 py-0.5 text-[11px] font-bold text-accent">
                                                                    FRAGILE
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="shrink-0 text-muted-foreground">
                                                            {item.weight_grams != null ? `${item.weight_grams * item.qty} g` : item.unit}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Accept lives here, not on the card — the decision is made with the
            full picture in view. */}
                <div className="border-t border-border bg-card px-5 pb-safe-6 pt-3">
                    <button
                        onClick={accept}
                        disabled={busy || accepting}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-primary-foreground transition active:scale-[0.99] disabled:opacity-60"
                    >
                        {busy || accepting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                Accept {isBatch ? "batch" : "order"} · {distance.totalKm.toFixed(1)} km
                                <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const Leg = ({
    icon,
    label,
    value,
    muted,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    muted?: boolean;
}) => (
    <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted-foreground">
            {icon} {label}
        </span>
        <span className={`font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</span>
    </div>
);

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="rounded-2xl bg-muted/60 p-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">{icon}</div>
        <div className="mt-1 text-sm font-extrabold text-foreground">{value}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
);
