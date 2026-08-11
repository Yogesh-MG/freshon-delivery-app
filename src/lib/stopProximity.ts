import { useMemo } from "react";
import { haversineKm } from "./tripDistance";
import { isDemoMode } from "./demo/demoMode";
import type { RiderPosition } from "./riderPosition";

/**
 * Proof-of-delivery proximity gate.
 *
 * The photo + OTP chain is evidence that the rider was *at the door*. Letting it
 * be started from anywhere makes it evidence of nothing: a rider could close a
 * stop from the hub, or from the previous drop, and the customer's OTP is the
 * only thing standing in the way. So the chain stays locked until the rider is
 * physically near the drop, and the backend's own 300 m geofence on
 * /mark-delivered/ becomes a second line rather than the first thing the rider
 * discovers — after taking a photo and asking for a code.
 *
 * The radius is deliberately looser than that server-side check: the gate should
 * open as the rider arrives on the street, not only once they are on the doorstep.
 */

/** Where the proof chain unlocks — the rider is on the block. */
export const PROOF_UNLOCK_RADIUS_M = 400;

/** Where the rider is treated as standing at the drop. Cosmetic only. */
export const ARRIVED_RADIUS_M = 200;

/**
 * How much of a poor fix's own error we're willing to forgive. Urban GPS
 * routinely reports ±50–100 m; without an allowance the rider at the door is
 * locked out by drift. Capped, because a 500 m fix would forgive the entire gate.
 */
export const ACCURACY_ALLOWANCE_CAP_M = 150;

export interface ProximityTarget {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface StopProximity {
  /** Metres to the stop. Null when the rider's position or the stop's is unknown. */
  distanceM: number | null;
  /** True when the proof chain may be started. */
  unlocked: boolean;
  /** True once the rider is close enough to be considered at the door. */
  arrived: boolean;
  /** The radius actually applied, i.e. base radius widened by the fix's error. */
  radiusM: number;
  /** Locked only because no fix has landed yet — the rider can retry, not walk. */
  awaitingFix: boolean;
}

const UNGATED: StopProximity = {
  distanceM: null,
  unlocked: true,
  arrived: false,
  radiusM: PROOF_UNLOCK_RADIUS_M,
  awaitingFix: false,
};

/** Metres between the rider and a point, great-circle. */
export function metresBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  return haversineKm(
    { lat: from.latitude, lng: from.longitude },
    { lat: to.latitude, lng: to.longitude },
  ) * 1000;
}

/**
 * Evaluate the gate for one stop.
 *
 * Two deliberate fail-open cases: a stop the backend sent without coordinates,
 * and demo mode. Neither can be measured, and locking a rider out of a delivery
 * they are standing at — because dispatch omitted a lat/lng — strands a real
 * customer's order. Everything measurable is gated.
 */
export function stopProximity(
  rider: RiderPosition | null,
  stop: ProximityTarget | null | undefined,
): StopProximity {
  if (!stop || stop.latitude == null || stop.longitude == null) return UNGATED;

  if (!rider) {
    return {
      distanceM: null,
      unlocked: false,
      arrived: false,
      radiusM: PROOF_UNLOCK_RADIUS_M,
      awaitingFix: true,
    };
  }

  const distanceM = metresBetween(rider, { latitude: stop.latitude, longitude: stop.longitude });
  const allowance = Math.min(Math.max(rider.accuracy ?? 0, 0), ACCURACY_ALLOWANCE_CAP_M);
  const radiusM = PROOF_UNLOCK_RADIUS_M + allowance;

  return {
    distanceM,
    // Demo mode runs against a fixed rider position kilometres from the seeded
    // drops, so gating it would make the demo flow impossible to walk. Dev-only.
    unlocked: distanceM <= radiusM || isDemoMode(),
    arrived: distanceM <= ARRIVED_RADIUS_M + allowance,
    radiusM,
    awaitingFix: false,
  };
}

export interface NearestTarget<T extends ProximityTarget> {
  target: T;
  distanceM: number;
}

export interface StopProximityResult<T extends ProximityTarget> {
  /** Gate state for a stop id. Anything not in `targets` reads as ungated. */
  of: (stopId: string) => StopProximity;
  /**
   * Every target the rider is already within range of, nearest first. A batch
   * dropped in one lane puts several stops in here at once; `inRange[0]` is the
   * one the rider is actually standing at, and the one worth opening for them.
   */
  inRange: NearestTarget<T>[];
}

export function useStopProximity<T extends ProximityTarget>(
  targets: T[],
  rider: RiderPosition | null,
): StopProximityResult<T> {
  // Key the memo on the numbers, not the object: a fresh `rider` arrives with
  // every GPS sample and would otherwise re-derive on identity churn alone.
  const riderLat = rider?.latitude ?? null;
  const riderLng = rider?.longitude ?? null;
  const riderAcc = rider?.accuracy ?? null;

  return useMemo(() => {
    const fix: RiderPosition | null =
      riderLat != null && riderLng != null
        ? { latitude: riderLat, longitude: riderLng, accuracy: riderAcc }
        : null;

    const byId = new Map<string, StopProximity>();
    const inRange: NearestTarget<T>[] = [];

    targets.forEach((target) => {
      const proximity = stopProximity(fix, target);
      byId.set(target.id, proximity);
      // Stops with no coordinates read as unlocked but have no distance, so
      // they can never be "the one the rider is standing at".
      if (proximity.unlocked && proximity.distanceM != null) {
        inRange.push({ target, distanceM: proximity.distanceM });
      }
    });
    inRange.sort((a, b) => a.distanceM - b.distanceM);

    return {
      of: (stopId: string) => byId.get(stopId) ?? UNGATED,
      inRange,
    };
  }, [targets, riderLat, riderLng, riderAcc]);
}

/** "180 m" / "1.2 km" — riders read metres up close and km beyond that. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}
