// packages/freshon-api/src/client.ts
// Central Axios HTTP client for all FreshOn apps.
// Handles JWT Bearer auth via localStorage (for mobile/Tauri) with automatic
// silent refresh and request queuing during refresh.
import axios from "axios";
// ─── Token Storage ────────────────────────────────────────────────────
const ACCESS_KEY = "freshon_access_token";
const REFRESH_KEY = "freshon_refresh_token";
export function setAuthTokens(access, refresh) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
}
export function getAccessToken() {
    return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
}
export function clearAuthTokens() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem("freshon_user");
    localStorage.removeItem("freshon_fos_user");
    localStorage.removeItem("freshon_farmer_user");
}
const DEFAULT_PUBLIC_ENDPOINTS = [
    "/api/auth/register/",
    "/api/auth/login/",
    "/api/auth/token/refresh/",
    "/api/inventory/categories/",
    "/api/inventory/batches/",
    "/api/inventory/farmers/",
    "/api/inventory/products/",
    "/api/inventory/promotions/",
];
// ─── Error messages ───────────────────────────────────────────────────
/**
 * The reason the SERVER gave, pulled out of a failed response.
 *
 * Axios sets `error.message` to "Request failed with status code 400" — which says
 * only that something went wrong, never what. The reason is in the body, and the
 * backend takes care to put a useful one there:
 *
 *     { "error": "variant_has_no_net_weight",
 *       "detail": "'1 pack' has no net weight, so a per-pack cost cannot be derived.
 *                  Set the net weight of one pack on the variant in Catalog." }
 *
 * Every FOS toast reads `e.message`, so throwing that body away meant the founder saw
 * "Request failed with status code 404" and had no idea a weight was missing. This
 * digs the real sentence out.
 *
 * Preference order: `detail` (written for a human) > `error` (a machine code, but
 * still better than nothing) > DRF field errors > axios's own message.
 */
export function errorMessageFromBody(data, fallback) {
    if (typeof data === "string" && data.trim())
        return data;
    if (!data || typeof data !== "object")
        return fallback;
    const body = data;
    // `detail` is the sentence written for a person to read. It wins.
    if (typeof body.detail === "string" && body.detail.trim())
        return body.detail;
    if (typeof body.error === "string" && body.error.trim()) {
        // A bare machine code ("duplicate_gstin") is poor, but a human can at least
        // search for it — "status code 409" tells them nothing at all.
        return body.error;
    }
    if (typeof body.message === "string" && body.message.trim())
        return body.message;
    // DRF field errors: { "gstin": ["This field is required."] }
    const fieldErrors = Object.entries(body)
        .filter(([, v]) => Array.isArray(v) && v.length && typeof v[0] === "string")
        .map(([field, msgs]) => `${field}: ${msgs[0]}`);
    if (fieldErrors.length)
        return fieldErrors.join(" · ");
    return fallback;
}
/**
 * @param fallback shown when the server said nothing useful. Pass the screen's own
 *   wording ("Could not add variant") — it beats axios's "Request failed with status
 *   code 500", which is what the caller would otherwise show.
 */
export function apiErrorMessage(err, fallback) {
    const last = fallback ?? (err instanceof Error ? err.message : "Something went wrong");
    const data = err?.response?.data;
    return errorMessageFromBody(data, last);
}
// ─── Client Factory ───────────────────────────────────────────────────
let _instance = null;
let _config = null;
/**
 * Initialize the FreshOn API client. Must be called once at app startup
 * (e.g. in main.tsx or App.tsx) before any API module is used.
 *
 * ```ts
 * import { initClient } from "@freshon/api";
 * initClient({ baseURL: import.meta.env.VITE_API_MAIN_URL });
 * ```
 */
export function initClient(config) {
    _config = config;
    const client = axios.create({
        baseURL: config.baseURL,
        withCredentials: true,
        xsrfCookieName: "csrftoken",
        xsrfHeaderName: "X-CSRFToken",
    });
    // ── Request interceptor: attach Bearer token ──────────────────────
    const publicEndpoints = config.publicEndpoints ?? DEFAULT_PUBLIC_ENDPOINTS;
    client.interceptors.request.use((req) => {
        const isPublic = publicEndpoints.some((ep) => req.url?.includes(ep));
        if (!isPublic) {
            const token = getAccessToken();
            if (token) {
                req.headers.Authorization = `Bearer ${token}`;
            }
        }
        // Geolocation Decorator: automatically append user active GPS coordinates to outgoing GET requests
        if (typeof localStorage !== "undefined" && req.method?.toLowerCase() === "get" && req.url?.includes("/api/")) {
            let lat = localStorage.getItem("freshon-lat");
            let lng = localStorage.getItem("freshon-lng");
            // freshon-lat/lng are only written by the address picker. A position that
            // came from the GPS permission prompt instead lands in `userLocation`, so
            // fall back to it — otherwise those sessions send no coordinates at all and
            // the backend can't judge per-product delivery reach.
            if (!lat || !lng) {
                try {
                    const saved = localStorage.getItem("userLocation");
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed?.latitude != null && parsed?.longitude != null) {
                            lat = String(parsed.latitude);
                            lng = String(parsed.longitude);
                        }
                    }
                }
                catch {
                    /* malformed userLocation — treat as no location */
                }
            }
            if (lat && lng) {
                req.params = {
                    latitude: lat,
                    longitude: lng,
                    ...req.params,
                };
            }
            // Content-language Decorator: append the consumer's chosen language so the
            // backend returns translated product content (falls back to English).
            // Only set when a non-default language is selected; harmless for apps
            // that never write this key.
            const lang = localStorage.getItem("freshon-content-lang");
            if (lang && lang !== "en") {
                req.params = {
                    lang,
                    ...req.params,
                };
            }
        }
        return req;
    });
    // ── Response interceptor: silent refresh on 401 ───────────────────
    let isRefreshing = false;
    let refreshSubscribers = [];
    function onRefreshed() {
        refreshSubscribers.forEach((cb) => cb());
        refreshSubscribers = [];
    }
    function redirectToAuth() {
        clearAuthTokens();
        if (typeof window !== "undefined") {
            // Don't redirect if user is in guest mode (browsing products)
            const guestMode = localStorage.getItem("freshon_guest_mode");
            const isPublicPage = window.location.pathname === "/" ||
                window.location.pathname === "/posts" ||
                window.location.pathname === "/search" ||
                window.location.pathname === "/pride" ||
                window.location.pathname === "/onboarding" ||
                window.location.pathname === "/verify-otp" ||
                window.location.pathname === "/login" ||
                window.location.pathname === "/signup" ||
                window.location.pathname.startsWith("/category/") ||
                window.location.pathname.startsWith("/product/") ||
                window.location.pathname.startsWith("/farmer/") ||
                window.location.pathname === "/categories" ||
                window.location.pathname === "/cart";
            // Only redirect to login if not on a public page and not in guest mode
            if (!isPublicPage && !guestMode) {
                window.location.href = config.authRedirectPath ?? "/welcome";
            }
        }
    }
    client.interceptors.response.use((response) => response, async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !originalRequest.url?.includes("/api/auth/token/refresh/")) {
            originalRequest._retry = true;
            // Queue subsequent requests while refresh is in progress
            if (isRefreshing) {
                return new Promise((resolve) => {
                    refreshSubscribers.push(resolve);
                }).then(() => client(originalRequest));
            }
            const refreshToken = getRefreshToken();
            if (!refreshToken) {
                redirectToAuth();
                return Promise.reject(error);
            }
            isRefreshing = true;
            try {
                const refreshResponse = await axios.post(`${config.baseURL}/api/auth/token/refresh/`, { refresh: refreshToken }, { withCredentials: true });
                const { access, refresh } = refreshResponse.data ?? {};
                if (!access || !refresh) {
                    throw new Error("Refresh response missing tokens");
                }
                setAuthTokens(access, refresh);
                isRefreshing = false;
                onRefreshed();
                return client(originalRequest);
            }
            catch {
                isRefreshing = false;
                refreshSubscribers = [];
                redirectToAuth();
                return Promise.reject(error);
            }
        }
        // Replace axios's "Request failed with status code 400" with what the server
        // actually said. Every caller already reads `e.message` for its toast, so this
        // makes the whole platform tell the truth without touching a single call site.
        // The original response is untouched on `error.response` for anyone who wants
        // the machine code (`error.response.data.error`) to branch on.
        const reason = apiErrorMessage(error);
        if (reason && reason !== error.message) {
            error.message = reason;
        }
        return Promise.reject(error);
    });
    _instance = client;
    return client;
}
/**
 * Returns the initialized Axios instance.
 * Throws if `initClient` was not called first.
 */
export function getClient() {
    if (!_instance) {
        throw new Error("[@freshon/api] Client not initialized. Call initClient({ baseURL }) before using API modules.");
    }
    return _instance;
}
/**
 * Returns the client config (baseURL etc.) for use in WebSocket connections.
 */
export function getClientConfig() {
    if (!_config) {
        throw new Error("[@freshon/api] Client not initialized. Call initClient({ baseURL }) first.");
    }
    return _config;
}
//# sourceMappingURL=client.js.map