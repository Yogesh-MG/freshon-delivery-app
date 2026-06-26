import { apiClient } from "./apiClient";
import { ApiResult } from "./types";

export interface CashDrop {
  id: string;
  amount: string;
  status: "PENDING" | "ACKNOWLEDGED" | "REJECTED" | "EXPIRED";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  expires_at: string | null;
  note: string;
}

export class CashDropService {
  static async create(amount: number): Promise<ApiResult<CashDrop>> {
    const response = await apiClient.post<CashDrop>("/api/delivery-partner/cash/drop/", { amount });
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  static async getStatus(dropId: string): Promise<ApiResult<CashDrop>> {
    const response = await apiClient.get<CashDrop>(`/api/delivery-partner/cash/drop/${dropId}/status/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }
}
