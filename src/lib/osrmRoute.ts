import { LatLng } from "./mapsUtils";

/**
 * Fetch a driving route through ordered waypoints from the public OSRM server
 * (open-source OpenStreetMap routing — no API key). Returns the road geometry as
 * [lat, lng][] for drawing on Leaflet, or null on any failure so the caller can
 * fall back to straight lines.
 */
export async function fetchOsrmRoute(points: LatLng[]): Promise<[number, number][] | null> {
  if (points.length < 2) return null;
  // OSRM expects lng,lat;lng,lat …
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const line = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(line) || line.length < 2) return null;
    // GeoJSON is [lng, lat] → Leaflet wants [lat, lng].
    return line.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
  } catch {
    return null;
  }
}
