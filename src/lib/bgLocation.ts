import { invoke } from "@tauri-apps/api/core";

/**
 * Foreground-service location tracking, active ONLY while a delivery is running.
 *
 * The JS WebSocket heartbeat (see deliverySocket.ts) stops the moment the app is
 * backgrounded, because the webview is frozen. For an in-progress delivery that
 * would blind dispatch to the rider's position. This hands tracking to a native
 * Android foreground service (plugins/tauri-plugin-bg-location) that keeps
 * PATCHing /api/delivery-partner/status/ while backgrounded, and shows the
 * persistent notification Android requires for the duration.
 *
 * Scope is deliberately narrow — no ACCESS_BACKGROUND_LOCATION, so no Google
 * Play background-location review. The service runs between start and stop only.
 *
 * On web / desktop the plugin's commands are no-ops, and we early-return anyway.
 */

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export interface StartTrackingArgs {
  /** Backend origin, e.g. https://api.freshon.in (trailing slash tolerated). */
  baseUrl: string;
  /** Bearer access token the service uses to authenticate the location PATCH. */
  token: string;
  /** Minimum ms between location reports. Defaults to 30s natively. */
  intervalMs?: number;
  notificationTitle?: string;
  notificationBody?: string;
}

/** Start the foreground service. Safe to call repeatedly — it refreshes the
 *  service's token/config with the latest values. */
export async function startBackgroundTracking(args: StartTrackingArgs): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await invoke("plugin:bg-location|start_tracking", { args });
  } catch (err) {
    console.warn("[bg-location] failed to start tracking:", err);
  }
}

/** Stop the foreground service and clear its notification. */
export async function stopBackgroundTracking(): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    await invoke("plugin:bg-location|stop_tracking");
  } catch (err) {
    console.warn("[bg-location] failed to stop tracking:", err);
  }
}
