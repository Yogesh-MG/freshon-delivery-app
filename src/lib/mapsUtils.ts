export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapsRouteOptions {
  /** Omit to let Google Maps use the device's current location as origin. */
  origin?: LatLng | null;
  destination: LatLng;
  waypoints?: LatLng[];
}

function isValidCoord(coord: LatLng | null | undefined): coord is LatLng {
  if (!coord) return false;
  return (
    typeof coord.lat === "number" &&
    typeof coord.lng === "number" &&
    !isNaN(coord.lat) &&
    !isNaN(coord.lng) &&
    coord.lat >= -90 &&
    coord.lat <= 90 &&
    coord.lng >= -180 &&
    coord.lng <= 180
  );
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Open a URL in the SYSTEM browser / native app — NOT the in-app Tauri webview.
 * Mirrors the Consumer app: inside Tauri we hand off via plugin-opener (with
 * plugin-shell as a fallback) so map/geo intents launch the real Google Maps app
 * instead of loading inside our webview. On plain web we open a new tab.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch (openerErr) {
      console.warn("[maps] opener plugin failed, trying shell:", openerErr);
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      return;
    }
  }
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
}

/**
 * Opens Google Maps directions externally — no API key or embed required.
 * On mobile, the native Google Maps app intercepts the URL automatically.
 * Format: https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=LAT,LNG&waypoints=...&travelmode=driving
 */
export function openGoogleMapsRoute({ origin, destination, waypoints = [] }: MapsRouteOptions): void {
  if (!isValidCoord(destination)) {
    throw new Error("Destination coordinates are missing or invalid");
  }

  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });

  if (isValidCoord(origin)) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }

  const validWaypoints = waypoints.filter(isValidCoord);
  if (validWaypoints.length > 0) {
    params.set("waypoints", validWaypoints.map((w) => `${w.lat},${w.lng}`).join("|"));
  }

  const url = `https://www.google.com/maps/dir/?${params.toString()}`;
  // Hand off to the native Google Maps app / system browser (fire-and-forget).
  void openExternalUrl(url);
}
