import type { TripStop } from "./deliveryTripService";

/**
 * A bag's handover QR is just the customer's order reference with a "D-" glued
 * on the front — order FRSH-A434EB travels in bag D-FRSH-A434EB. Nothing else
 * is encoded, so a scan can be verified on the device: strip the prefix and the
 * remainder has to equal one of this trip's drop-off order ids.
 */
export const BAG_CODE_PREFIX = "D-";

/** Codes are printed uppercase; compare them that way so a typed-in lowercase
 *  code from the manual fallback still matches. */
export const normalizeOrderId = (value?: string | null): string => (value ?? "").trim().toUpperCase();

export const bagCodeForOrder = (orderId?: string | null): string =>
  `${BAG_CODE_PREFIX}${normalizeOrderId(orderId)}`;

/** The order reference carried by a bag code, or null if it isn't one. */
export const orderIdFromBagCode = (raw: string): string | null => {
  const code = normalizeOrderId(raw);
  if (!code.startsWith(BAG_CODE_PREFIX)) return null;
  const orderId = code.slice(BAG_CODE_PREFIX.length).trim();
  return orderId || null;
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
  const orderId = orderIdFromBagCode(raw);
  if (!orderId) return { ok: false, reason: "malformed", orderId: null };

  const stop = stops.find(
    (s) => s.type === "dropoff" && normalizeOrderId(s.order_id) === orderId,
  );
  if (!stop) return { ok: false, reason: "unknown", orderId };
  if (stop.bag_scanned || scanned.some((b) => b.stop_id === stop.id)) {
    return { ok: false, reason: "duplicate", orderId };
  }

  return { ok: true, stop, orderId, code: bagCodeForOrder(orderId) };
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
