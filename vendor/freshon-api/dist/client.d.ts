import { AxiosInstance } from "axios";
export declare function setAuthTokens(access: string, refresh: string): void;
export declare function getAccessToken(): string | null;
export declare function getRefreshToken(): string | null;
export declare function clearAuthTokens(): void;
export interface FreshOnClientConfig {
    /** Base URL for the Django backend (e.g. "https://yogesh843120.pythonanywhere.com") */
    baseURL: string;
    /** Path to redirect to on auth failure (default: "/welcome") */
    authRedirectPath?: string;
    /** Public endpoints that skip the Bearer header (default: register, login, refresh) */
    publicEndpoints?: string[];
}
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
export declare function errorMessageFromBody(data: unknown, fallback: string): string;
/**
 * @param fallback shown when the server said nothing useful. Pass the screen's own
 *   wording ("Could not add variant") — it beats axios's "Request failed with status
 *   code 500", which is what the caller would otherwise show.
 */
export declare function apiErrorMessage(err: unknown, fallback?: string): string;
/**
 * Initialize the FreshOn API client. Must be called once at app startup
 * (e.g. in main.tsx or App.tsx) before any API module is used.
 *
 * ```ts
 * import { initClient } from "@freshon/api";
 * initClient({ baseURL: import.meta.env.VITE_API_MAIN_URL });
 * ```
 */
export declare function initClient(config: FreshOnClientConfig): AxiosInstance;
/**
 * Returns the initialized Axios instance.
 * Throws if `initClient` was not called first.
 */
export declare function getClient(): AxiosInstance;
/**
 * Returns the client config (baseURL etc.) for use in WebSocket connections.
 */
export declare function getClientConfig(): FreshOnClientConfig;
//# sourceMappingURL=client.d.ts.map