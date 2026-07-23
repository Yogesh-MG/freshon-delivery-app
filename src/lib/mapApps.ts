import { LatLng, openExternalUrl } from "./mapsUtils";

export interface NavTarget {
  /** Omit to let Google Maps use the device's current location. */
  origin?: LatLng | null;
  destination: LatLng;
  waypoints?: LatLng[];
}

/**
 * Build a Google Maps directions URL.
 *
 * Google Maps is the only supported hand-off: riders tap Navigate mid-shift,
 * often one-handed, and an app-picker sheet is a second decision at exactly the
 * wrong moment. It's also the only common map app that accepts an origin plus
 * ordered waypoints, which a multi-drop trip needs — Waze and the generic `geo:`
 * intent take a single destination and silently drop the rest of the route.
 */
export function buildGoogleMapsUrl(t: NavTarget): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${t.destination.lat},${t.destination.lng}`,
    travelmode: "driving",
  });
  if (t.origin) params.set("origin", `${t.origin.lat},${t.origin.lng}`);
  if (t.waypoints?.length) {
    params.set("waypoints", t.waypoints.map((w) => `${w.lat},${w.lng}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Hand the route straight to Google Maps via the system opener (not the webview,
 * which would trap the rider inside the app with no back affordance).
 */
export function openInGoogleMaps(t: NavTarget): void {
  void openExternalUrl(buildGoogleMapsUrl(t));
}
