import { apiClient } from "./apiClient";
import { ApiResult, EarningsStats } from "./types";

export class DeliveryStatusService {
  static async updateStatus(online: boolean, latitude?: number, longitude?: number): Promise<ApiResult<{ online: boolean }>> {
    const response = await apiClient.patch<{ online: boolean }>("/api/delivery-partner/status/", {
      online,
      latitude,
      longitude,
    });
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  static async getEarnings(): Promise<ApiResult<EarningsStats>> {
    const response = await apiClient.get<EarningsStats>("/api/delivery-partner/earnings/");
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  static async uploadProof(formData: FormData): Promise<ApiResult<{ url: string }>> {
    const response = await apiClient.post<{ url: string }>("/api/delivery-partner/proof/", formData);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }
}
