import { apiClient } from "./apiClient";
import { ApiResult, Assignment } from "./types";

export class DeliveryAssignmentService {
  static async getAssignments(): Promise<ApiResult<Assignment[]>> {
    const response = await apiClient.get<Assignment[]>("/api/delivery-partner/assignments/");
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data || [] };
  }

  static async acceptAssignment(id: string): Promise<ApiResult<Assignment>> {
    const response = await apiClient.post<Assignment>(`/api/delivery-partner/assignments/${id}/accept/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  static async markPickedUp(id: string, handoverCode: string): Promise<ApiResult> {
    const response = await apiClient.post(`/api/delivery-partner/assignments/${id}/pickup/`, {
      handover_code: handoverCode,
    });
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }

  static async markInTransit(id: string, latitude?: number, longitude?: number): Promise<ApiResult> {
    const response = await apiClient.post(`/api/delivery-partner/assignments/${id}/transit/`, {
      latitude,
      longitude,
    });
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }

  static async markDelivered(
    id: string,
    stopId: string,
    type: "otp" | "photo",
    otpCode?: string,
    latitude?: number,
    longitude?: number,
  ): Promise<ApiResult> {
    const response = await apiClient.post(`/api/delivery-partner/assignments/${id}/deliver/`, {
      stop_id: stopId,
      type,
      otp_code: otpCode,
      latitude,
      longitude,
    });
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }

  static async resendOtp(id: string): Promise<ApiResult> {
    const response = await apiClient.post(`/api/delivery-partner/assignments/${id}/resend-otp/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }
}
