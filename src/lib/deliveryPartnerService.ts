import { apiClient } from "./apiClient";
import { ApiResult } from "./types";

export type DocType = "aadhaar" | "pan" | "driving_licence" | "vehicle_rc" | "insurance";

export interface DeliveryPartnerProfile {
  id: number;
  username: string;
  name: string;
  phone: string;
  vehicle_type: "BIKE" | "SCOOTER" | "CYCLE" | "VAN";
  vehicle_number: string;
  address: string;
  city: string;
  pincode: string;
  // Payout / payment KYC — how the partner gets paid.
  payout_method: "" | "UPI" | "BANK";
  bank_upi: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  is_online: boolean;
  total_deliveries: number;
  total_earnings: number;
  rating: number;
}

export interface DailyEarning {
  date: string;
  earnings: number;
  deliveries: number;
  distance: number;
}

export interface RecentDelivery {
  id: string;
  date: string;
  earnings: number;
  distance: number;
  service: "swift" | "next-day" | "standard";
}

export interface EarningsHistory {
  period: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    total_earnings: number;
    total_deliveries: number;
    total_distance: number;
  };
  daily_breakdown: DailyEarning[];
  lifetime: {
    total_earnings: number;
    total_deliveries: number;
    rating: number;
  };
  recent_deliveries: RecentDelivery[];
}

export interface KycDocument {
  id: string;
  doc_type: DocType;
  doc_type_display: string;
  doc_number: string;
  file: string;
  file_url: string | null;
  status: "pending" | "verified" | "rejected";
  status_display: string;
  uploaded_at: string;
  verified_at: string | null;
  rejection_reason: string;
}

export interface KycStatus {
  required_count: number;
  uploaded_count: number;
  is_complete: boolean;
  missing_documents: DocType[];
}

export interface KycDocumentsResponse {
  documents: KycDocument[];
  kyc_status: KycStatus;
}

export class DeliveryPartnerService {
  static async getProfile(): Promise<ApiResult<DeliveryPartnerProfile>> {
    const response = await apiClient.get<DeliveryPartnerProfile>("/api/delivery-partner/profile/");
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  static async updateProfile(
    data: Partial<
      Pick<
        DeliveryPartnerProfile,
        | "name"
        | "phone"
        | "vehicle_type"
        | "vehicle_number"
        | "address"
        | "city"
        | "pincode"
        | "payout_method"
        | "bank_upi"
        | "bank_account_name"
        | "bank_account_number"
        | "bank_ifsc"
      >
    >
  ): Promise<ApiResult<DeliveryPartnerProfile>> {
    const response = await apiClient.patch<DeliveryPartnerProfile>("/api/delivery-partner/profile/", data);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  static async getEarningsHistory(days = 30): Promise<ApiResult<EarningsHistory>> {
    const response = await apiClient.get<EarningsHistory>(`/api/delivery-partner/earnings/history/?days=${days}`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  // KYC Document APIs
  static async getKycDocuments(): Promise<ApiResult<KycDocumentsResponse>> {
    const response = await apiClient.get<KycDocumentsResponse>("/api/delivery-partner/documents/");
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  static async uploadKycDocument(
    docType: DocType,
    docNumber: string,
    file: File
  ): Promise<ApiResult<KycDocumentsResponse>> {
    const formData = new FormData();
    formData.append("doc_type", docType);
    formData.append("doc_number", docNumber);
    formData.append("file", file);

    const response = await apiClient.post<KycDocumentsResponse>("/api/delivery-partner/documents/", formData);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }
}
