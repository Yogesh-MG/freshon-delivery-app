import { useEffect, useMemo, useRef, useState } from "react";
import type { DeliveryTrip } from "./deliveryTripService";
import type { LatLng } from "./mapsUtils";

/**
 * What a rider actually rides for a trip is two legs, not one:
 *
 *   1. where they are now → the hub   (the approach — the backend never sees it)
 *   2. the hub → every drop-off       (`trip.total_distance_km`)
 *
 * Quoting only leg 2 understates a trip by however far the rider happens to be
 * from the hub, which is exactly the number they need to judge whether the fare
 * is worth taking. This module resolves leg 1 and adds the two together.
 */

const EARTH_RADIUS_KM = 6371;

/** Great-circle km between two points. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Straight-line distance undersells road distance badly in a city. Until OSRM
 * answers, scale the crow-flies figure by the usual urban detour factor so the
 * first number a rider sees is not an obvious lie.
 */
export const ROAD_DETOUR_FACTOR = 1.3;

export const hubLatLng = (trip: DeliveryTrip): LatLng | null =>
  trip.hub?.latitude != null && trip.hub?.longitude != null
    ? { lat: trip.hub.latitude, lng: trip.hub.longitude }
    : null;

/** Trips out of the same hub share an approach leg — key on the coordinates. */
const keyOf = (point: LatLng) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;

/** Road km between two points from OSRM. `overview=false` skips the geometry. */
async function osrmDistanceKm(from: LatLng, to: LatLng): Promise<number | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const metres = data?.routes?.[0]?.distance;
    return typeof metres === "number" ? metres / 1000 : null;
  } catch {
    return null;
  }
}

export interface TripDistance {
  /** Rider → hub. Null when the rider's position or the hub's is unknown. */
  approachKm: number | null;
  /** Hub → every drop-off, as optimized by the backend. */
  routeKm: number;
  /** What the rider actually rides. */
  totalKm: number;
  /** True while this is still the crow-flies estimate, not the road distance. */
  estimated: boolean;
}

/**
 * Resolve the approach leg for a pool of trips. One request per distinct hub,
 * not per trip — a batch of offers usually shares one. Callers get a usable
 * number on the first render (scaled haversine) that sharpens when OSRM lands.
 */
export function useTripDistance(
  trips: DeliveryTrip[],
  rider: { latitude: number; longitude: number } | null,
) {
  const [roadKm, setRoadKm] = useState<Record<string, number>>({});
  // Hubs already requested this session, so re-renders don't re-fetch.
  const requested = useRef(new Set<string>());

  // Read the coordinates out first so the memo keys on the numbers rather than
  // the object: callers build a fresh `rider` on every GPS sample, and that
  // identity churn would otherwise re-fetch every hub each time.
  const riderLat = rider?.latitude ?? null;
  const riderLng = rider?.longitude ?? null;
  const origin = useMemo<LatLng | null>(
    () => (riderLat != null && riderLng != null ? { lat: riderLat, lng: riderLng } : null),
    [riderLat, riderLng],
  );

  const hubs = useMemo(() => {
    const seen = new Map<string, LatLng>();
    trips.forEach((trip) => {
      const hub = hubLatLng(trip);
      if (hub) seen.set(keyOf(hub), hub);
    });
    return [...seen.entries()];
  }, [trips]);

  // A moved rider invalidates every cached leg — they are all measured from it.
  const originKey = origin ? keyOf(origin) : null;
  useEffect(() => {
    requested.current.clear();
    setRoadKm({});
  }, [originKey]);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    hubs.forEach(([key, hub]) => {
      if (requested.current.has(key)) return;
      requested.current.add(key);
      void osrmDistanceKm(origin, hub).then((km) => {
        if (cancelled || km == null) return;
        setRoadKm((current) => ({ ...current, [key]: km }));
      });
    });
    return () => { cancelled = true; };
  }, [hubs, origin]);

  return useMemo(() => {
    return (trip: DeliveryTrip): TripDistance => {
      const routeKm = Number(trip.total_distance_km) || 0;
      const hub = hubLatLng(trip);
      if (!origin || !hub) {
        return { approachKm: null, routeKm, totalKm: routeKm, estimated: false };
      }
      const road = roadKm[keyOf(hub)];
      const approachKm = road ?? haversineKm(origin, hub) * ROAD_DETOUR_FACTOR;
      return {
        approachKm,
        routeKm,
        totalKm: approachKm + routeKm,
        estimated: road == null,
      };
    };
  }, [origin, roadKm]);
}

const PACKAGING_KG = 1; // 1 kg overhead per trip for packaging materials

/**
 * Total load in kg, or null when no item on the trip reports a weight — the
 * available-trips payload does not always carry them.
 */
export function tripWeightKg(trip: DeliveryTrip): number | null {
  const items = trip.stops.flatMap((s) => s.items || []);
  if (items.length === 0) return null;
  if (!items.some((item) => item.weight_grams != null)) return null;
  const grams = items.reduce((sum, item) => sum + (item.weight_grams ?? 0) * item.qty, 0);
  return grams / 1000 + PACKAGING_KG;
}
