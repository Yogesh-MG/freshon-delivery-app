import type { TripStop } from "./deliveryTripService";

/**
 * A bag's handover QR carries the order reference and which bag of that order
 * it is: `D-FRSH-4CC553-1`. The order part may also be spelt as the bare
 * reference suffix — `D-4CC553-1` is the same bag — and the trailing index is
 * REQUIRED. Without it the last segment is eaten as the index and the code
 * resolves to nonsense.
 *
 * This mirrors the server's own parse exactly, verified against the live API:
 *
 *   D-4CC553-1       → FRSH-4CC553   ✓ accepted
 *   D-FRSH-4CC553-1  → FRSH-4CC553   ✓ accepted
 *   D-FRSH-4CC553    → FRSH-FRSH     ✗ "does not match stop"
 *   D-4CC553         → —             ✗ "Unrecognised code"
 *
 * Keeping the two parses identical is the whole point: a code this module
 * accepts must be one the handover will accept, or the rider is told a bag is
 * fine and then refused at the end of the scan.
 */
export const BAG_CODE_PREFIX = "D-";

/** Reference prefix the server assumes when a code carries only the suffix. */
const ORDER_PREFIX = "FRSH-";

/** Codes are printed uppercase; compare them that way so a typed-in lowercase
 *  code from the manual fallback still matches. */
export const normalizeOrderId = (value?: string | null): string => (value ?? "").trim().toUpperCase();

/** The code printed on bag `index` of an order. */
export const bagCodeForOrder = (orderId?: string | null, index = 1): string =>
  `${BAG_CODE_PREFIX}${normalizeOrderId(orderId)}-${index}`;

const withPrefix = (ref: string): string => (ref.startsWith(ORDER_PREFIX) ? ref : `${ORDER_PREFIX}${ref}`);

/**
 * The order reference carried by a bag code, parsed exactly as the server does
 * it — last segment dropped as the bag index. Returns null for a code the
 * server would call unrecognised.
 */
export const orderIdFromBagCode = (raw: string): string | null => {
  const code = normalizeOrderId(raw);
  if (!code.startsWith(BAG_CODE_PREFIX)) return null;

  const body = code.slice(BAG_CODE_PREFIX.length);
  const cut = body.lastIndexOf("-");
  if (cut <= 0) return null;
  return withPrefix(body.slice(0, cut));
};

/**
 * Every order this code could plausibly name, best reading first, each paired
 * with the code to actually send for it.
 *
 * Two readings because the trailing bag index is what the server keys on but
 * not what a rider necessarily types. `D-FRSH-4CC553-1` is unambiguous; a
 * hand-entered `D-FRSH-4CC553` is missing its index and the server would read
 * it as order FRSH-FRSH. Rather than refuse that outright we take it as bag 1
 * and send it that way — being strict here would reject a bag the rider is
 * holding over a formatting detail.
 */
const readBagCode = (code: string): { orderId: string; send: string }[] => {
  if (!code.startsWith(BAG_CODE_PREFIX)) return [];
  const body = code.slice(BAG_CODE_PREFIX.length);
  if (!body) return [];

  const readings: { orderId: string; send: string }[] = [];
  const cut = body.lastIndexOf("-");
  // Printed form: the last segment is the bag index, so the code goes as-is.
  if (cut > 0) readings.push({ orderId: withPrefix(body.slice(0, cut)), send: code });
  // No index in the code — treat the whole body as the reference, bag 1.
  readings.push({ orderId: withPrefix(body), send: `${code}-1` });
  return readings;
};

/** One verified bag, reported to the backend in the handover batch. */
export interface ScannedBag {
  stop_id: string;
  order_id: string;
  code: string;
}

export type BagMatch =
  | { ok: true; stop: TripStop; orderId: string; code: string }
  | { ok: false; reason: "malformed" | "unknown" | "duplicate"; orderId: string | null };

/**
 * Resolve a scanned code against the trip. The code alone decides which bag was
 * scanned — the rider may tap any row and scan whatever bag is in their hand.
 */
export const matchBagCode = (raw: string, stops: TripStop[], scanned: ScannedBag[] = []): BagMatch => {
  const readings = readBagCode(normalizeOrderId(raw));
  if (readings.length === 0) return { ok: false, reason: "malformed", orderId: null };

  for (const { orderId, send } of readings) {
    const stop = stops.find(
      (s) => s.type === "dropoff" && normalizeOrderId(s.order_id) === orderId,
    );
    if (!stop) continue;
    if (stop.bag_scanned || scanned.some((b) => b.stop_id === stop.id)) {
      return { ok: false, reason: "duplicate", orderId };
    }
    // `send`, not the raw scan: the server re-parses this string and needs the
    // bag index present, whether or not the rider typed one.
    return { ok: true, stop, orderId, code: send };
  }

  return { ok: false, reason: "unknown", orderId: readings[0].orderId };
};

/**
 * The handover gate: every drop-off has to be covered, either by a bag scanned
 * in this session or by one the backend already recorded. Whatever comes back
 * is what the rider still has to scan before the handover can be confirmed.
 */
export const unverifiedStops = (stops: TripStop[], scanned: ScannedBag[]): TripStop[] => {
  const codes = new Set(scanned.map((b) => normalizeOrderId(b.order_id)));
  return stops.filter(
    (s) => s.type === "dropoff" && !s.bag_scanned && !codes.has(normalizeOrderId(s.order_id)),
  );
};

/** Human label for a stop that failed verification — the order id when the
 *  payload carries one, the address label otherwise. */
export const stopRef = (stop: TripStop): string => stop.order_id || stop.label;
