import type { CurrentUser, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, TokenRefreshResponse } from "../types";
/**
 * Register a new customer account.
 * POST /api/auth/register/
 */
export declare function register(data: RegisterRequest): Promise<RegisterResponse>;
/**
 * Login with username + password.
 * POST /api/auth/login/
 * Stores JWT tokens in localStorage for subsequent requests.
 */
export declare function login(data: LoginRequest): Promise<LoginResponse>;
/**
 * Send a login OTP to a phone number.
 * POST /api/auth/send-otp/
 */
export declare function sendOtp(phone: string): Promise<{
    phone: string;
    message: string;
}>;
export interface VerifyOtpResponse {
    access: string;
    refresh: string;
    user: CurrentUser;
    device_auth_key?: string;
    device_auth_key_expires?: string;
}
/**
 * Verify a login OTP and receive JWT tokens.
 * POST /api/auth/verify-otp/
 * Stores tokens for Bearer auth on success. NOTE: an unknown phone creates a new
 * CUSTOMER/DELIVERY user server-side — callers that gate on role (e.g. FOS) must
 * inspect the returned `user.role`.
 */
export declare function verifyOtp(data: {
    phone: string;
    otp: string;
    device_name?: string;
    device_identifier?: string;
}): Promise<VerifyOtpResponse>;
/**
 * Logout — blacklists the refresh token on the server and clears local storage.
 * POST /api/auth/logout/
 */
export declare function logout(): Promise<void>;
/**
 * Get the currently authenticated user.
 * GET /api/auth/me/
 * The Axios interceptor handles silent token refresh automatically.
 */
export declare function me(): Promise<CurrentUser>;
/**
 * Manually refresh the access token.
 * POST /api/auth/token/refresh/
 * Usually the response interceptor handles this automatically,
 * but this is exposed for explicit refresh scenarios.
 */
export declare function refreshTokens(): Promise<TokenRefreshResponse>;
//# sourceMappingURL=auth.d.ts.map