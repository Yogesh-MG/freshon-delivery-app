/**
 * OS-level notifications for delivery events.
 *
 * Three backends, picked at runtime in this order:
 *   1. Tauri notification plugin — real Android notifications that appear in the
 *      shade and on the lock screen. This is the one that matters in production:
 *      a rider with the phone in their pocket sees nothing else.
 *   2. Web Notification API — for `npm run dev` in a desktop browser.
 *   3. No-op — SSR, unsupported browsers, or permission denied.
 *
 * In-app toasts (sonner) are NOT replaced by this. Toasts cover the case where
 * the rider is already looking at the screen; these cover the case where they
 * aren't. Both fire for high-priority events — see useDeliverySocket.
 */

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Backend = "tauri" | "web" | "none";

let backend: Backend | null = null;
let granted = false;

/** Lazily import the Tauri plugin so browser dev builds never load it. */
async function tauriApi() {
  return import("@tauri-apps/plugin-notification");
}

function detectBackend(): Backend {
  if (backend) return backend;
  if (isTauri()) backend = "tauri";
  else if (typeof window !== "undefined" && "Notification" in window) backend = "web";
  else backend = "none";
  return backend;
}

/**
 * Ask for notification permission.
 *
 * Call this from a user gesture — Android 13+ (API 33) shows a runtime prompt
 * for POST_NOTIFICATIONS, and browsers reject silent requests. The natural
 * moment is the rider flipping themselves online, which is where it's wired.
 *
 * Returns true if notifications can now be shown.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  switch (detectBackend()) {
    case "tauri": {
      try {
        const { isPermissionGranted, requestPermission } = await tauriApi();
        granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === "granted";
        return granted;
      } catch {
        return false;
      }
    }
    case "web": {
      try {
        if (Notification.permission === "granted") {
          granted = true;
        } else if (Notification.permission !== "denied") {
          granted = (await Notification.requestPermission()) === "granted";
        }
        return granted;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

export interface NotifyOptions {
  title: string;
  body: string;
  /**
   * Stable id for a logically-identical notification. Reusing an id replaces the
   * previous one instead of stacking — e.g. every trip offer uses OFFER_ID so a
   * rider never accumulates a column of stale offers.
   */
  id?: number;
}

/** Fixed ids for notifications that should replace rather than stack. */
export const NOTIFY_ID = {
  offer: 1001,
  offerGone: 1002,
  connection: 1003,
} as const;

/**
 * Show an OS notification. Never throws and never blocks the caller — a failed
 * notification must not take down the event handler that triggered it.
 */
export async function notify({ title, body, id }: NotifyOptions): Promise<void> {
  const kind = detectBackend();
  if (kind === "none") return;

  // Don't prompt from here; a notification arriving mid-flow is the wrong moment
  // to interrupt with a permission dialog. If permission was never granted we
  // simply skip — the in-app toast still fires.
  if (!granted) {
    const stillGranted = await hasPermission();
    if (!stillGranted) return;
  }

  try {
    if (kind === "tauri") {
      const { sendNotification } = await tauriApi();
      sendNotification({ title, body, ...(id !== undefined ? { id } : {}) });
    } else {
      new Notification(title, { body, tag: id !== undefined ? String(id) : undefined, renotify: id !== undefined } as NotificationOptions);
    }
  } catch {
    /* notification failed — non-fatal by design */
  }
}

/** Check current permission without prompting. */
export async function hasPermission(): Promise<boolean> {
  switch (detectBackend()) {
    case "tauri":
      try {
        const { isPermissionGranted } = await tauriApi();
        granted = await isPermissionGranted();
        return granted;
      } catch {
        return false;
      }
    case "web":
      granted = typeof Notification !== "undefined" && Notification.permission === "granted";
      return granted;
    default:
      return false;
  }
}

/**
 * True when the app is backgrounded or the screen is off. Used to decide whether
 * an OS notification is worth firing at all — if the rider is staring at the
 * offer sheet, the toast and the sound are enough.
 */
export function isBackgrounded(): boolean {
  return typeof document !== "undefined" && document.visibilityState !== "visible";
}
