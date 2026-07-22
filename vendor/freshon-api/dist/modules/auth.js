// packages/freshon-api/src/modules/auth.ts
// Authentication module — login, register, logout, me, refresh.
// Maps to Django's apps/accounts/views.py endpoints.
import { getClient, setAuthTokens, clearAuthTokens, getRefreshToken } from "../client";
/**
 * Register a new customer account.
 * POST /api/auth/register/
 */
export async function register(data) {
    const res = await getClient().post("/api/auth/register/", data);
    return res.data;
}
/**
 * Login with username + password.
 * POST /api/auth/login/
 * Stores JWT tokens in localStorage for subsequent requests.
 */
export async function login(data) {
    const res = await getClient().post("/api/auth/login/", data);
    // Store tokens for Bearer auth (mobile/Tauri WebView can't always use cookies)
    if (res.data.access && res.data.refresh) {
        setAuthTokens(res.data.access, res.data.refresh);
    }
    return res.data;
}
/**
 * Send a login OTP to a phone number.
 * POST /api/auth/send-otp/
 */
export async function sendOtp(phone) {
    const res = await getClient().post("/api/auth/send-otp/", { phone });
    return res.data;
}
/**
 * Verify a login OTP and receive JWT tokens.
 * POST /api/auth/verify-otp/
 * Stores tokens for Bearer auth on success. NOTE: an unknown phone creates a new
 * CUSTOMER/DELIVERY user server-side — callers that gate on role (e.g. FOS) must
 * inspect the returned `user.role`.
 */
export async function verifyOtp(data) {
    const res = await getClient().post("/api/auth/verify-otp/", data);
    if (res.data.access && res.data.refresh) {
        setAuthTokens(res.data.access, res.data.refresh);
    }
    return res.data;
}
/**
 * Logout — blacklists the refresh token on the server and clears local storage.
 * POST /api/auth/logout/
 */
export async function logout() {
    const refresh = getRefreshToken();
    try {
        await getClient().post("/api/auth/logout/", refresh ? { refresh } : {});
    }
    catch {
        // Treat as successful even if server rejects — we clear local state regardless
    }
    clearAuthTokens();
}
/**
 * Get the currently authenticated user.
 * GET /api/auth/me/
 * The Axios interceptor handles silent token refresh automatically.
 */
export async function me() {
    const res = await getClient().get("/api/auth/me/");
    return res.data;
}
/**
 * Manually refresh the access token.
 * POST /api/auth/token/refresh/
 * Usually the response interceptor handles this automatically,
 * but this is exposed for explicit refresh scenarios.
 */
export async function refreshTokens() {
    const refresh = getRefreshToken();
    if (!refresh) {
        throw new Error("No refresh token available");
    }
    const res = await getClient().post("/api/auth/token/refresh/", { refresh });
    if (res.data.access && res.data.refresh) {
        setAuthTokens(res.data.access, res.data.refresh);
    }
    return res.data;
}
//# sourceMappingURL=auth.js.map