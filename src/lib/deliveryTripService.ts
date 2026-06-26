import { apiClient } from "./apiClient";
import { ApiResult } from "./types";

export interface TripStop {
  id: string;
  type: "pickup" | "dropoff";
  label: string;
  address: string;
  customer?: string;
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

export class DeliveryTripService {
  static async getActiveTrip(): Promise<ApiResult<DeliveryTrip | null>> {
    const response = await apiClient.get<{ trip: DeliveryTrip | null }>("/api/delivery-partner/trips/active/");
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trip ?? null };
  }

  static async getAvailableTrips(): Promise<ApiResult<DeliveryTrip[]>> {
    const response = await apiClient.get<{ trips: DeliveryTrip[] }>("/api/delivery-partner/trips/available/");
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trips || [] };
  }

  static async acceptTrip(id: string): Promise<ApiResult<DeliveryTrip>> {
    const response = await apiClient.post<{ trip: DeliveryTrip }>(`/api/delivery-partner/trips/${id}/accept/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trip };
  }

  static async confirmTripPickup(id: string): Promise<ApiResult<DeliveryTrip>> {
    const response = await apiClient.post<{ trip: DeliveryTrip }>(`/api/delivery-partner/trips/${id}/pickup/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trip };
  }

  static async scanBag(tripId: string, code: string): Promise<ApiResult<DeliveryTrip>> {
    const response = await apiClient.post<{ trip: DeliveryTrip }>(
      `/api/delivery-partner/trips/${tripId}/scan-bag/`,
      { code },
    );
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trip };
  }

  static async cancelTrip(id: string): Promise<ApiResult<void>> {
    const response = await apiClient.post(`/api/delivery-partner/trips/${id}/cancel/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }

  static async reoptimize(id: string): Promise<ApiResult<DeliveryTrip>> {
    const response = await apiClient.post<{ trip: DeliveryTrip }>(`/api/delivery-partner/trips/${id}/reoptimize/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data?.trip };
  }
}
