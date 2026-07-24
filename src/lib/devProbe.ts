/**
 * Dev-only record of what the API actually returns for a drop-off stop.
 *
 * The delivery-partner endpoints are all auth-gated, so the payload shape can
 * only be observed from inside a signed-in session — there is no way to inspect
 * it from outside the app. This captures the first real drop-off that arrives so
 * the dev bar can show, on the device, exactly which fields the backend sends
 * and whether any of them is a contact number.
 *
 * Vite folds import.meta.env.DEV to a literal false in production, so every
 * write below is dead code there and Rollup drops this module with it.
 */

export interface StopProbe {
  /** Every key present on the drop-off object the API returned. */
  keys: string[];
  /** The contact number resolved from those keys, if any. */
  phone: string | null;
  /** Which endpoint the sample came from. */
  source: string;
}

let latest: StopProbe | null = null;
const listeners = new Set<() => void>();

export const recordStopShape = (probe: StopProbe) => {
  if (!import.meta.env.DEV) return;
  latest = probe;
  listeners.forEach((fn) => fn());
};

export const getStopProbe = () => latest;

export const subscribeStopProbe = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
