import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { decodePolyline } from "@/lib/polyline";
import { fetchOsrmRoute } from "@/lib/osrmRoute";
import { NavTarget } from "@/lib/mapApps";
import { NavChooser } from "./NavChooser";
import { LocateFixed, Loader2, Navigation } from "lucide-react";

export interface MapStop {
  latitude: number | null;
  longitude: number | null;
  type: "pickup" | "dropoff";
  label: string;
  sequence: number;
  is_completed?: boolean;
}

interface DeliveryMapProps {
  stops: MapStop[];
  /** Pre-computed encoded route (e.g. backend-optimized trip). Takes precedence over OSRM. */
  polyline?: string;
  rider?: { latitude: number; longitude: number } | null;
  /** When true (default) and no `polyline` is given, draw an OSRM road route through rider → stops. */
  enableRouting?: boolean;
  /** Show a floating "Navigate" button that opens the map-app chooser. */
  enableNavigate?: boolean;
  /** Show a "locate me" button that centers the map on the rider's live GPS. */
  enableLocate?: boolean;
  /** Called with fresh coordinates when the rider taps "locate me". */
  onLocate?: (coords: { latitude: number; longitude: number }) => void;
  className?: string;
}

/** Ordered route waypoints: rider first, then pickup(s), then drop-offs by sequence. */
function orderedWaypoints(
  stops: MapStop[],
  rider?: { latitude: number; longitude: number } | null,
): { lat: number; lng: number }[] {
  const pts: { lat: number; lng: number }[] = [];
  if (rider) pts.push({ lat: rider.latitude, lng: rider.longitude });
  const withGeo = stops.filter((s) => s.latitude != null && s.longitude != null);
  const pickups = withGeo.filter((s) => s.type === "pickup");
  const drops = withGeo
    .filter((s) => s.type === "dropoff")
    .sort((a, b) => a.sequence - b.sequence);
  [...pickups, ...drops].forEach((s) => pts.push({ lat: s.latitude!, lng: s.longitude! }));
  return pts;
}

const hubIcon = () =>
  L.divIcon({
    className: "",
    html: `<div style="display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:hsl(38 92% 55%);color:#1a1a1a;font-weight:800;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.3)">H</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

const dropIcon = (n: number, done?: boolean) =>
  L.divIcon({
    className: "",
    html: `<div style="display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:${
      done ? "hsl(142 30% 55%)" : "hsl(142 72% 35%)"
    };color:#fff;font-weight:800;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.3)">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const riderIcon = () =>
  L.divIcon({
    className: "",
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

export const DeliveryMap = ({
  stops,
  polyline,
  rider,
  enableRouting = true,
  enableNavigate = false,
  enableLocate = false,
  onLocate,
  className,
}: DeliveryMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  // Road geometry fetched from OSRM when no encoded polyline is supplied.
  const [routeGeom, setRouteGeom] = useState<[number, number][] | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  // Locally-fetched "you are here" position (from the locate button).
  const [myPos, setMyPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // The rider marker shows the freshest known position.
  const me = myPos ?? rider ?? null;

  const handleLocate = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!navigator.geolocation) {
      if (me) map.setView([me.latitude, me.longitude], 16, { animate: true });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMyPos(coords);
        map.setView([coords.latitude, coords.longitude], 16, { animate: true });
        onLocate?.(coords);
        setLocating(false);
      },
      () => {
        setLocating(false);
        if (me) map.setView([me.latitude, me.longitude], 16, { animate: true });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
    );
  };

  const waypoints = orderedWaypoints(stops, rider);

  // Where "Navigate" routes to: last waypoint is the destination; the rider (if
  // present) is the origin and any middle stops become waypoints.
  const navTarget: NavTarget | null = (() => {
    if (waypoints.length === 0) return null;
    const destination = waypoints[waypoints.length - 1];
    const hasRiderOrigin = !!rider && waypoints.length >= 2;
    return {
      origin: hasRiderOrigin ? waypoints[0] : null,
      destination,
      waypoints: hasRiderOrigin ? waypoints.slice(1, -1) : waypoints.slice(0, -1),
    };
  })();
  // Stable key so the fetch effect only re-runs when the actual coordinates change.
  const waypointsKey = waypoints.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    if (polyline || !enableRouting || waypoints.length < 2) {
      setRouteGeom(null);
      return;
    }
    let cancelled = false;
    fetchOsrmRoute(waypoints).then((geom) => {
      if (!cancelled) setRouteGeom(geom);
    });
    return () => {
      cancelled = true;
    };
    // waypointsKey captures the coordinate changes; waypoints itself is a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypointsKey, polyline, enableRouting]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
    }).setView([20.5937, 78.9629], 12); // India fallback
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw markers + route whenever data changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds: [number, number][] = [];

    // Route line priority: backend encoded polyline → OSRM road geometry →
    // straight dashed line through the ordered waypoints (offline fallback).
    if (polyline) {
      const path = decodePolyline(polyline);
      if (path.length > 1) {
        L.polyline(path, { color: "hsl(142 72% 35%)", weight: 4, opacity: 0.85 }).addTo(layer);
        bounds.push(...path);
      }
    } else if (routeGeom && routeGeom.length > 1) {
      L.polyline(routeGeom, { color: "hsl(142 72% 35%)", weight: 4, opacity: 0.85 }).addTo(layer);
      bounds.push(...routeGeom);
    } else if (waypoints.length > 1) {
      const straight = waypoints.map((p) => [p.lat, p.lng] as [number, number]);
      L.polyline(straight, {
        color: "hsl(142 72% 35%)",
        weight: 3,
        opacity: 0.6,
        dashArray: "6 8",
      }).addTo(layer);
      bounds.push(...straight);
    }

    let dropNum = 0;
    stops.forEach((s) => {
      if (s.latitude == null || s.longitude == null) return;
      const pt: [number, number] = [s.latitude, s.longitude];
      bounds.push(pt);
      if (s.type === "pickup") {
        L.marker(pt, { icon: hubIcon() }).addTo(layer).bindPopup(s.label);
      } else {
        dropNum += 1;
        L.marker(pt, { icon: dropIcon(dropNum, s.is_completed) }).addTo(layer).bindPopup(s.label);
      }
    });

    if (me) {
      const pt: [number, number] = [me.latitude, me.longitude];
      bounds.push(pt);
      L.marker(pt, { icon: riderIcon() }).addTo(layer);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 16 });
    }
  }, [stops, polyline, rider, routeGeom, myPos]);

  const hasGeo = stops.some((s) => s.latitude != null && s.longitude != null);

  return (
    <div className={`relative overflow-hidden ring-1 ring-border ${className || "h-52 rounded-3xl"}`}>
      <div ref={containerRef} className="h-full w-full" />
      {!hasGeo && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card/80 text-center text-xs font-semibold text-muted-foreground">
          Awaiting stop coordinates…
        </div>
      )}
      {enableLocate && (
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          aria-label="Show my location"
          className="absolute bottom-3 left-3 z-[400] grid h-11 w-11 place-items-center rounded-full bg-card text-primary shadow-elevated ring-1 ring-border active:scale-95 disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
        </button>
      )}
      {enableNavigate && navTarget && (
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="absolute bottom-3 right-3 z-[400] flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow-primary active:scale-95"
        >
          <Navigation className="h-4 w-4" /> Navigate
        </button>
      )}
      <NavChooser target={navOpen ? navTarget : null} onClose={() => setNavOpen(false)} />
    </div>
  );
};
