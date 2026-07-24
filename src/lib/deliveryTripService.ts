import { apiClient } from "./apiClient";
import { ApiResult } from "./types";
import { recordStopShape } from "./devProbe";

export interface TripStop {
  id: string;
  type: "pickup" | "dropoff";
  label: string;
  address: string;
  customer?: string;
  /** Contact number for the drop-off, normalized from whatever key the API
   *  uses (see PHONE_KEYS). Undefined when the payload carries none. */
  customer_phone?: string;
  eta?: string;
  notes?: string;
  latitude: number | null;
  longitude: number | null;
  sequence: number;
  is_completed: boolean;
  /** True once the rider has scanned this bag's QR at the hub. */
  bag_scanned: boolean;
  /** The owning assignment (drop-offs only; null for the hub pickup). */
  assignment: string | null;
  items?: { name: string; qty: number; unit: string; weight_grams: number | null; fragile?: boolean }[];
}

export interface TripHub {
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface DeliveryTrip {
  id: string;
  status: "PENDING" | "ASSIGNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  total_distance_km: number;
  total_duration_min: number;
  stop_count: number;
  encoded_polyline: string;
  is_optimized: boolean;
  /** Sum of earnings across all assignments in this trip. Added by backend. */
  earnings?: number;
  hub: TripHub | null;
  stops: TripStop[];
}

/**
 * Field names a drop-off's contact number might arrive under.
 *
 * There is no documented endpoint that returns a customer's number, and the
 * shared `@freshon/api` MissionStop type has no phone field — so the exact
 * spelling isn't knowable from this repo. The number belongs on the stop
 * payload the trip endpoints already return, so rather than guess one name,
 * accept any of these and normalize to `customer_phone`. The Call button then
 * works the moment the backend sends one, whatever it calls it.
 */
const PHONE_KEYS = [
  "customer_phone",
  "customer_mobile",
  "customer_contact",
  "contact_number",
  "contact_phone",
  "phone",
  "mobile",
];

const readPhone = (stop: TripStop): string | undefined => {
  const raw = stop as unknown as Record<string, unknown>;
  for (const key of PHONE_KEYS) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
};

/**
 * In dev, record what a drop-off actually carries. The endpoints are auth-gated,
 * so this is the only way to see whether the backend sends a contact number and
 * under which key. Surfaced on-device by the dev bar, and logged once for
 * anyone with a console attached.
 */
let phoneShapeLogged = false;
const logStopShape = (trip: DeliveryTrip | null, source: string) => {
  if (!import.meta.env.DEV || !trip) return;
  const dropoff = trip.stops.find((s) => s.type === "dropoff");
  if (!dropoff) return;
  const keys = Object.keys(dropoff);
  const phone = readPhone(dropoff) ?? null;
  recordStopShape({ keys, phone, source });
  if (phoneShapeLogged) return;
  phoneShapeLogged = true;
  console.info(
    `[trips] drop-off payload keys (${source}): ${keys.join(", ")}\n` +
      `[trips] contact number resolved: ${phone ?? "NONE — no phone-like field present"}`,
  );
};

const normalizeTrip = (trip: DeliveryTrip): DeliveryTrip => ({
  ...trip,
  stops: trip.stops.map((stop) =>
    stop.type === "dropoff" ? { ...stop, customer_phone: readPhone(stop) } : stop,
  ),
});

export class DeliveryTripService {
  static async getActiveTrip(): Promise<ApiResult<DeliveryTrip | null>> {
    const response = await apiClient.get<{ trip: DeliveryTrip | null }>("/api/delivery-partner/trips/active/");
    if (response.error) return { success: false, error: response.error };
    const trip = response.data?.trip ?? null;
    logStopShape(trip, "trips/active");
    return { success: true, data: trip ? normalizeTrip(trip) : null };
  }

  static async getAvailableTrips(): Promise<ApiResult<DeliveryTrip[]>> {
    const response = await apiClient.get<{ trips: DeliveryTrip[] }>("/api/delivery-partner/trips/available/");
    if (response.error) return { success: false, error: response.error };
    const trips = response.data?.trips || [];
    logStopShape(trips[0] ?? null, "trips/available");
    return { success: true, data: trips.map(normalizeTrip) };
  }

  static async acceptTrip(id: string): Promise<ApiResult<DeliveryTrip>> {
    const response = await apiClient.post<{ trip: DeliveryTrip }>(`/api/delivery-partner/trips/${id}/accept/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trip ? normalizeTrip(response.data.trip) : undefined };
  }

  static async confirmTripPickup(id: string): Promise<ApiResult<DeliveryTrip>> {
    const response = await apiClient.post<{ trip: DeliveryTrip }>(`/api/delivery-partner/trips/${id}/pickup/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trip ? normalizeTrip(response.data.trip) : undefined };
  }

  static async scanBag(tripId: string, code: string): Promise<ApiResult<DeliveryTrip>> {
    const response = await apiClient.post<{ trip: DeliveryTrip }>(
      `/api/delivery-partner/trips/${tripId}/scan-bag/`,
      { code },
    );
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trip ? normalizeTrip(response.data.trip) : undefined };
  }

  static async cancelTrip(id: string): Promise<ApiResult<void>> {
    const response = await apiClient.post(`/api/delivery-partner/trips/${id}/cancel/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }

  static async reoptimize(id: string): Promise<ApiResult<DeliveryTrip>> {
    const response = await apiClient.post<{ trip: DeliveryTrip }>(`/api/delivery-partner/trips/${id}/reoptimize/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trip ? normalizeTrip(response.data.trip) : undefined };
  }
}
