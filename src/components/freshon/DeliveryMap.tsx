import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { decodePolyline } from "@/lib/polyline";

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
  polyline?: string;
  rider?: { latitude: number; longitude: number } | null;
  className?: string;
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

export const DeliveryMap = ({ stops, polyline, rider, className }: DeliveryMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

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

    const path = polyline ? decodePolyline(polyline) : [];
    if (path.length > 1) {
      L.polyline(path, { color: "hsl(142 72% 35%)", weight: 4, opacity: 0.85 }).addTo(layer);
      bounds.push(...path);
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

    if (rider) {
      const pt: [number, number] = [rider.latitude, rider.longitude];
      bounds.push(pt);
      L.marker(pt, { icon: riderIcon() }).addTo(layer);
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 16 });
    }
  }, [stops, polyline, rider]);

  const hasGeo = stops.some((s) => s.latitude != null && s.longitude != null);

  return (
    <div className={`relative overflow-hidden rounded-3xl ring-1 ring-border ${className || "h-52"}`}>
      <div ref={containerRef} className="h-full w-full" />
      {!hasGeo && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card/80 text-center text-xs font-semibold text-muted-foreground">
          Awaiting stop coordinates…
        </div>
      )}
    </div>
  );
};
