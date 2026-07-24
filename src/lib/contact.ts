import { openExternalUrl } from "./mapsUtils";

/**
 * FreshOn rider support line. PLACEHOLDER — swap for the real number.
 * Kept here rather than inline so there is exactly one place to change.
 */
export const SUPPORT_PHONE = "+91 80000 00000";

/** Strip formatting down to what a `tel:` URL accepts (digits and a leading +). */
export const toDialable = (phone: string) => phone.replace(/[^+\d]/g, "");

/**
 * Hand a number to the system dialer, pre-filled and ready to place.
 *
 * Routed through the Tauri opener (same path as the Navigate hand-off) rather
 * than an <a href="tel:">, which the Android webview swallows — it treats the
 * unknown scheme as a navigation, fails it, and the rider gets nothing. The
 * opener's default permission set covers `tel:` explicitly.
 */
export const dialPhone = (phone: string) => {
  const number = toDialable(phone);
  if (!number) return;
  void openExternalUrl(`tel:${number}`);
};
