import { apiClient } from "./apiClient";
import { ApiResult } from "./types";
import type { ScannedBag } from "./bagCode";
import { recordStopShape } from "./devProbe";

export interface TripStop {
  id: string;
  type: "pickup" | "dropoff";
  label: string;
  address: string;
  customer?: string;
  /** Contact number for the drop-off. Sent by the API as `customer_phone`;
   *  empty string on the hub stop, normalized to undefined (see PHONE_KEYS). */
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
  /** Customer-facing order reference, e.g. "FRSH-2FC946". */
  order_id?: string | null;
  /** Total parcel weight in kg, straight from the backend. The rider is told
   *  weight, never contents. */
  weight_kg?: number | null;
  /** How many physical parcels make up this stop — a count, never the products. */
  parcel_count?: number;
  /**
   * Cash due at this door, in rupees. Not sent by the live payload yet; when it
   * is, the drawer stops asking prepaid customers for cash and starts recording
   * how much was actually taken. See `lib/cod.ts`.
   */
  cod_amount?: number | string | null;
  /** Per-item manifest. Not sent by the live trips payload; kept only for the
   *  demo backend's fixtures. */
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
  /** The API serializes this as a decimal STRING ("14.46"), not a number.
   *  Always read it through `tripKm()` — calling .toFixed() on it directly
   *  throws. */
  total_distance_km: number | string;
  total_duration_min: number;
  stop_count: number;
  encoded_polyline: string;
  is_optimized: boolean;
  /** Sum of earnings across all assignments in this trip. Added by backend. */
  earnings?: number;
  hub: TripHub | null;
  stops: TripStop[];
}

/** Hub → drops distance as a number. The API sends it as a decimal string. */
export const tripKm = (trip: DeliveryTrip): number => Number(trip.total_distance_km) || 0;

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

  /**
   * Hub handover. Bag codes are matched to their drop-off on the device as they
   * are scanned (see lib/bagCode.ts), then reported here in one batch alongside
   * the trip they belong to — the backend re-checks them and rejects the
   * handover if any order id is unaccounted for.
   */
  static async confirmTripPickup(id: string, bags: ScannedBag[] = []): Promise<ApiResult<DeliveryTrip>> {
    const response = await apiClient.post<{ trip: DeliveryTrip }>(
      `/api/delivery-partner/trips/${id}/pickup/`,
      { trip_id: id, bags },
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
