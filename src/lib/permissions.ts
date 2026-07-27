/**
 * The two OS grants a rider must have before they can go online:
 *   - "navigation" access = foreground location (ACCESS_FINE_LOCATION)
 *   - notifications       = POST_NOTIFICATIONS (Android 13+)
 *
 * Both are requested from a user gesture (flipping online) — the only context in
 * which Android will show the runtime prompts. If either is refused the caller
 * blocks the rider from going online; see Index.tsx `updateOnline`.
 */

import { isDemoMode } from "@/lib/demo/demoMode";

export { requestNotificationPermission } from "@/lib/notify";

/**
 * Request "navigation" (location) access and report whether it's usable.
 *
 * On Android, `getCurrentPosition` is what makes Tauri's WebView raise the OS
 * ACCESS_FINE_LOCATION prompt, so this call doubles as the request. A slow or
 * missing GPS fix (POSITION_UNAVAILABLE / TIMEOUT) is NOT a denied permission —
 * the rider may simply be indoors — so only an explicit PERMISSION_DENIED counts
 * as refused. Everything else is treated as granted.
 */
export async function ensureLocationPermission(): Promise<boolean> {
  // Demo mode serves a canned rider position, so there's nothing to grant.
  if (isDemoMode()) return true;
  if (typeof navigator === "undefined" || !navigator.geolocation) return false;

  return new Promise<boolean>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      (err) => resolve(err.code !== err.PERMISSION_DENIED),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}
