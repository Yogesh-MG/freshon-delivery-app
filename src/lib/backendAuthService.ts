import { apiClient } from "./apiClient";
import { ApiResult, DeliveryAuthUser } from "./types";

interface SendOtpResponse {
  phone: string;
  message: string;
}

interface VerifyOtpResponse {
  device_auth_key: string;
  device_auth_key_expires: string;
  user: DeliveryAuthUser;
}

const USER_KEY = "freshon_delivery_user";
const DEVICE_KEY = "freshon_delivery_device_auth_key";

export class BackendAuthService {
  static async sendOtp(phone: string): Promise<ApiResult<SendOtpResponse>> {
    const response = await apiClient.post<SendOtpResponse>("/api/auth/send-otp/", { phone });
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  static async verifyOtp(phone: string, otp: string): Promise<ApiResult<DeliveryAuthUser>> {
    const response = await apiClient.post<VerifyOtpResponse>("/api/auth/verify-otp/", { phone, otp });

    if (response.error) return { success: false, error: response.error };

    const deviceKey = response.data?.device_auth_key;
    const user = response.data?.user;

    if (!deviceKey || !user) return { success: false, error: "OTP verification failed" };
    if (user.role !== "DELIVERY") return { success: false, error: "This account is not a delivery partner" };

    // Store device auth key (long-lived)
    apiClient.setTokens(deviceKey);
    localStorage.setItem(DEVICE_KEY, deviceKey);
    localStorage.setItem("freshon_delivery_device_key_expires", response.data?.device_auth_key_expires || "");
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return { success: true, data: user };
  }

  static async getCurrentUser(): Promise<ApiResult<DeliveryAuthUser> & { status?: number }> {
    // Use the delivery-partner endpoint authed by the 90-day device key, NOT
    // /api/auth/me/ (which relies on the short-lived JWT cookie that webviews
    // drop — making a valid session look expired).
    const response = await apiClient.get<DeliveryAuthUser>("/api/delivery-partner/me/");
    if (response.error) return { success: false, error: response.error, status: response.status };
    if (response.data) localStorage.setItem(USER_KEY, JSON.stringify(response.data));
    return { success: true, data: response.data, status: response.status };
  }

  static async logout(): Promise<ApiResult> {
    await apiClient.post("/api/auth/logout/");
    apiClient.clearTokens();
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(DEVICE_KEY);
    localStorage.removeItem("freshon_delivery_device_key_expires");
    return { success: true };
  }

  /** Clear all locally-stored credentials without a network round-trip. */
  static clearSession(): void {
    apiClient.clearTokens();
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(DEVICE_KEY);
    localStorage.removeItem("freshon_delivery_device_key_expires");
  }

  static getStoredUser(): DeliveryAuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DeliveryAuthUser;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }

  static getDeviceAuthKey(): string | null {
    return localStorage.getItem(DEVICE_KEY);
  }
}

export const backendAuthService = BackendAuthService;
