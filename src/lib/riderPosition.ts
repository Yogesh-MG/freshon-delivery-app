import { useEffect, useRef } from "react";
import { isDemoMode } from "./demo/demoMode";

/**
 * The rider's own position, as the UI consumes it.
 *
 * `accuracy` rides along because the proof-of-delivery gate (stopProximity.ts)
 * measures the rider against a fixed radius: a fix that is itself ±80 m has to
 * widen that radius, or a rider standing at the door gets locked out by GPS
 * drift alone.
 */
export interface RiderPosition {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy in metres, when the device reports one. */
  accuracy?: number | null;
}

/** Rider standing just outside the demo hub, so the map draws a real leg even
 *  on a desktop browser that has no (or refuses) geolocation. */
export const DEMO_RIDER: RiderPosition = { latitude: 12.9318, longitude: 77.6206, accuracy: 10 };

/** One-shot fix. Resolves null rather than rejecting — every caller treats an
 *  unknown position as "not yet known", not as an error to surface. */
export const getCurrentCoords = () => new Promise<RiderPosition | null>((resolve) => {
  if (isDemoMode()) {
    resolve(DEMO_RIDER);
    return;
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    resolve(null);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
    }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
  );
});

/**
 * Keep the rider's position live for as long as `active` holds.
 *
 * A one-shot fix taken when the trip was accepted is useless to a gate that
 * unlocks on arrival — the whole point is to notice the rider *moving* into
 * range. watchPosition delivers that without polling, and the browser/OS is
 * free to coalesce updates.
 *
 * `maximumAge: 0` is deliberate: a cached fix from before the rider set off
 * would report them at the hub while they stand at the door.
 */
export function useWatchRiderPosition(
  active: boolean,
  onPosition: (position: RiderPosition) => void,
) {
  // Callers pass an inline callback; hold it in a ref so a new identity each
  // render doesn't tear down and restart the watch.
  const handler = useRef(onPosition);
  handler.current = onPosition;

  useEffect(() => {
    if (!active) return;
    if (isDemoMode()) {
      handler.current(DEMO_RIDER);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (position) => handler.current({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
      }),
      // A failed sample keeps the last known fix rather than blanking it — the
      // gate falls back to "waiting for GPS" only when nothing has ever landed.
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);
}
