/**
 * Full-screen trip offer overlay.
 *
 * Appears when the backend pushes a trip_available event via WebSocket.
 * Drivers within the dispatch radius get an active "Claim" button; drivers
 * outside range see a dimmed "Out of range" state but can still watch the
 * offer (they cannot claim — backend enforces this too).
 *
 * A 25-second countdown auto-dismisses the offer so the screen doesn't sit
 * idle if the driver ignores it.
 */

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  Package,
  Route,
  X,
} from "lucide-react";
import { DeliveryTrip } from "@/lib/deliveryTripService";
import { ClaimResult } from "@/lib/deliverySocket";

const OFFER_TTL_SECONDS = 25;

interface Props {
  trip: DeliveryTrip;
  inRange: boolean;
  onClaim: (tripId: string) => Promise<ClaimResult>;
  onDismiss: () => void;
}

export const TripOffer = ({ trip, inRange, onClaim, onDismiss }: Props) => {
  const [secondsLeft, setSecondsLeft] = useState(OFFER_TTL_SECONDS);
  const [claiming, setClaiming] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer — auto-dismiss when it hits 0.
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          onDismiss();
          return 0;
        }
        return s - 1;
      });
    }, 1_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [onDismiss]);

  const handleClaim = async () => {
    if (!inRange || claiming) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setClaiming(true);
    await onClaim(trip.id);
    setClaiming(false);
  };

  const dropoffs = trip.stops.filter((s) => s.type === "dropoff");
  const progressPct = (secondsLeft / OFFER_TTL_SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-secondary/95 backdrop-blur-sm animate-slide-up">
      {/* Countdown bar */}
      <div className="h-1 bg-muted overflow-hidden">
        <div
          className="h-full bg-accent transition-all ease-linear"
          style={{ width: `${progressPct}%`, transitionDuration: "1s" }}
        />
      </div>

      <div className="flex items-center justify-between px-5 pt-5 text-primary-foreground">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-glow">
            New trip available
          </div>
          <div className="text-xl font-extrabold">
            {dropoffs.length} stop{dropoffs.length !== 1 ? "s" : ""} · {Number(trip.total_distance_km).toFixed(1)} km
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm font-bold text-accent">
            <Clock className="h-4 w-4" /> {secondsLeft}s
          </div>
          <button
            onClick={onDismiss}
            className="rounded-full bg-white/10 p-2"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-3 px-5">
        <StatCard
          icon={<Route className="h-4 w-4" />}
          label="Distance"
          value={`${Number(trip.total_distance_km).toFixed(1)} km`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Est. time"
          value={`~${trip.total_duration_min} min`}
        />
        <StatCard
          icon={<IndianRupee className="h-4 w-4" />}
          label="Earnings"
          value={trip.earnings != null ? `₹${Number(trip.earnings).toFixed(0)}` : "—"}
          accent
        />
      </div>

      {/* Stop list */}
      <div className="mt-4 flex-1 overflow-y-auto px-5 space-y-2">
        {dropoffs.map((stop, i) => (
          <div key={stop.id} className="flex items-start gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/20 text-xs font-extrabold text-primary">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-primary-foreground">
                {stop.customer || stop.label}
              </div>
              <div className="flex items-center gap-1 text-xs text-primary-foreground/60">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{stop.address || stop.label}</span>
              </div>
              {stop.items && stop.items.length > 0 && (
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-primary-foreground/50">
                  <Package className="h-3 w-3" />
                  {stop.items.map((it) => `${it.name} ×${it.qty}`).join(" · ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Hub info */}
      {trip.hub && (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2.5 text-xs text-primary-foreground/70">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
          Pickup from <span className="font-semibold text-primary-foreground ml-1">{trip.hub.label}</span>
        </div>
      )}

      {/* CTA */}
      <div className="px-5 py-5">
        {inRange ? (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-amber py-4 text-base font-extrabold text-accent-foreground shadow-glow-amber disabled:opacity-80"
          >
            {claiming ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Claiming…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" /> Claim This Trip
              </>
            )}
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-4 text-sm font-bold text-primary-foreground/50 ring-1 ring-white/10">
            <AlertCircle className="h-4 w-4" /> Out of dispatch range
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) => (
  <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary-foreground/60">
      {icon} {label}
    </div>
    <div className={`mt-1 text-base font-extrabold ${accent ? "text-accent-glow" : "text-primary-foreground"}`}>
      {value}
    </div>
  </div>
);
