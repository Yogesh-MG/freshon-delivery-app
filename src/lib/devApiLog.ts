/**
 * Dev-only recorder of real API traffic.
 *
 * Response shapes can't be read from outside the app — every endpoint is
 * auth-gated and there's no public schema — and the TypeScript interfaces in
 * `src/lib/` have already proved wrong (total_distance_km is a string, items[]
 * doesn't exist, weight_kg was undeclared). So rather than trust or guess the
 * shapes, this captures what the server actually sends and lets it be exported.
 *
 * Keeps the most recent call per endpoint, so a session of normal use yields one
 * real sample of each. Vite folds import.meta.env.DEV to false in production, so
 * this whole module is dropped from release bundles.
 */

export interface ApiCall {
  method: string;
  endpoint: string;
  status: number;
  at: string;
  request?: unknown;
  response?: unknown;
}

/** Collapse ids out of a path so repeat calls share one slot. */
const routeKey = (method: string, endpoint: string) => {
  const path = endpoint
    .split("?")[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/{id}")
    .replace(/\/\d+(?=\/|$)/g, "/{id}");
  return `${method} ${path}`;
};

/** Never let a credential end up in an exported dump. */
const SECRET_KEYS = /token|password|secret|device_auth_key|authorization|refresh|access/i;

const redact = (value: unknown, depth = 0): unknown => {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 3).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "«redacted»" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
};

const calls = new Map<string, ApiCall>();
const listeners = new Set<() => void>();

export const recordApiCall = (call: ApiCall) => {
  if (!import.meta.env.DEV) return;
  calls.set(routeKey(call.method, call.endpoint), {
    ...call,
    request: redact(call.request),
    response: redact(call.response),
  });
  listeners.forEach((fn) => fn());
};

export const getApiLog = (): ApiCall[] => [...calls.values()];
export const getApiLogCount = () => calls.size;

export const subscribeApiLog = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

/** The exportable document: one real request/response per endpoint. */
export const dumpApiLog = () =>
  JSON.stringify(
    {
      captured: getApiLog().length,
      base_url: import.meta.env.VITE_API_URL,
      endpoints: getApiLog().sort((a, b) => a.endpoint.localeCompare(b.endpoint)),
    },
    null,
    2,
  );
