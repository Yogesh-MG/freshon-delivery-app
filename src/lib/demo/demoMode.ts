/**
 * Dev-only demo mode.
 *
 * With it on, every delivery-partner API call is answered by an in-memory fake
 * backend (see demoBackend.ts) instead of the real server, so the whole rider
 * journey — pool → accept → bag scan → hub pickup → per-stop delivery → trip
 * complete — can be walked in a browser with no session, no server-side state,
 * no camera and no real handover QR. It exists so the UI can be reviewed and
 * changed against a flow that actually runs to the end.
 *
 * Vite substitutes a literal `false` for import.meta.env.DEV in production, so
 * `isDemoMode()` folds to a constant there and Rollup drops the fake backend
 * along with it — this can never ship enabled.
 */

const STORAGE_KEY = "freshon_demo_mode";

const readStored = () => {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

let enabled = import.meta.env.DEV && readStored();

export const isDemoMode = () => import.meta.env.DEV && enabled;

/**
 * Flip demo mode and reload. The reload is deliberate: it drops the fake
 * backend's in-memory state and re-runs auth, so each toggle starts from a
 * known-clean flow rather than a half-real, half-demo screen.
 */
export const setDemoMode = (on: boolean) => {
  if (!import.meta.env.DEV) return;
  enabled = on;
  try {
    if (on) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private-mode storage — the in-memory flag still holds for this session */
  }
  if (typeof window !== "undefined") window.location.reload();
};
