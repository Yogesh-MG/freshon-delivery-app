import { LatLng, openExternalUrl } from "./mapsUtils";

export type MapApp = "google" | "waze" | "other";

export interface NavTarget {
  /** Omit to let the map app use the device's current location. */
  origin?: LatLng | null;
  destination: LatLng;
  waypoints?: LatLng[];
}

/** Build the deep-link URL for a given navigation app. */
export function buildMapUrl(app: MapApp, t: NavTarget): string {
  const dest = `${t.destination.lat},${t.destination.lng}`;

  if (app === "waze") {
    // Waze only takes a single destination.
    return `https://waze.com/ul?ll=${dest}&navigate=yes`;
  }

  if (app === "other") {
    // Generic geo: intent — Android shows its own app chooser.
    return `geo:${dest}?q=${dest}`;
  }

  // Google Maps directions (supports origin + waypoints).
  const params = new URLSearchParams({ api: "1", destination: dest, travelmode: "driving" });
  if (t.origin) params.set("origin", `${t.origin.lat},${t.origin.lng}`);
  if (t.waypoints?.length) {
    params.set("waypoints", t.waypoints.map((w) => `${w.lat},${w.lng}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Hand the route off to the chosen app via the system opener (not the webview). */
export function openInMapApp(app: MapApp, t: NavTarget): void {
  void openExternalUrl(buildMapUrl(app, t));
}
