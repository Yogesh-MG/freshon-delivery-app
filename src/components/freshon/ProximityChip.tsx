import { Lock, MapPin, Navigation2 } from "lucide-react";
import { formatDistance, PROOF_UNLOCK_RADIUS_M, type StopProximity } from "@/lib/stopProximity";

/**
 * Row-level readout of the proof gate: how far the drop is, and whether the
 * photo + OTP chain is open there yet. Shown on pending drop-offs only — a
 * completed stop has nothing left to unlock.
 *
 * Renders nothing when the stop can't be measured at all (no coordinates from
 * dispatch), because there is no gate to explain in that case.
 */
export const ProximityChip = ({ proximity }: { proximity: StopProximity }) => {
  if (proximity.awaitingFix) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
        <Lock className="h-2.5 w-2.5" /> Waiting for GPS
      </span>
    );
  }

  if (proximity.distanceM == null) return null;

  const away = formatDistance(proximity.distanceM);

  if (!proximity.unlocked) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
        <Lock className="h-2.5 w-2.5" /> {away} away · unlocks at {PROOF_UNLOCK_RADIUS_M} m
      </span>
    );
  }

  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary">
      {proximity.arrived ? <MapPin className="h-2.5 w-2.5" /> : <Navigation2 className="h-2.5 w-2.5" />}
      {proximity.arrived ? "At the drop" : "In range"} · {away}
    </span>
  );
};
