import type { TripStop } from "./deliveryTripService";

/**
 * A bag's handover QR encodes a URL — `https://freshon.in/q/D-63EE1C-1` — whose
 * last path segment is the bag code: the bare order reference (no FRSH- prefix)
 * behind a `D-`, then the bag index. `D-63EE1C-1` is bag 1 of order FRSH-63EE1C.
 *
 * The server keys orders as `FRSH-XXXXXX` and parses the code by dropping the
 * trailing segment as the bag index, verified against the live API:
 *
 *   D-4CC553-1       → FRSH-4CC553   ✓ accepted
 *   D-FRSH-4CC553-1  → FRSH-4CC553   ✓ accepted
 *   D-FRSH-4CC553    → FRSH-FRSH     ✗ "does not match stop"
 *   D-4CC553         → —             ✗ "Unrecognised code"
 *
 * Which is why everything sent up from here is first rewritten to the one
 * canonical spelling `D-XXXXXX-N`: whatever the rider scanned or typed — the
 * full URL, an old FRSH-prefixed label, a code missing its index — the server
 * only ever sees the form it is known to accept.
 */
export const BAG_CODE_PREFIX = "D-";

/** Reference prefix the server keys orders by; never part of a printed code. */
const ORDER_PREFIX = "FRSH-";

/** Codes are printed uppercase; compare them that way so a typed-in lowercase
 *  code from the manual fallback still matches. */
export const normalizeOrderId = (value?: string | null): string => (value ?? "").trim().toUpperCase();

/** The order reference without its FRSH- spelling, however it arrived. */
const bareRef = (ref: string): string =>
  ref.startsWith(ORDER_PREFIX) ? ref.slice(ORDER_PREFIX.length) : ref;

/**
 * The code carried by a scan. The camera hands over whatever the QR encodes —
 * the printed labels wrap the code in a URL — so the last path segment is the
 * code; a hand-typed bare code has no slash and passes through whole.
 */
export const codeFromScan = (raw?: string | null): string => {
  const value = (raw ?? "").trim().replace(/\/+$/, "");
  const cut = value.lastIndexOf("/");
  return normalizeOrderId(cut >= 0 ? value.slice(cut + 1) : value);
};

/** The code printed on bag `index` of an order: `D-XXXXXX-N`, no FRSH. */
export const bagCodeForOrder = (orderId?: string | null, index = 1): string =>
  `${BAG_CODE_PREFIX}${bareRef(normalizeOrderId(orderId))}-${index}`;

/**
 * One canonical reading of a code: the FRSH-keyed order it names, and the
 * `D-XXXXXX-N` spelling to actually send. A missing bag index is taken as bag 1
 * rather than refused — being strict there would reject a bag the rider is
 * physically holding over a formatting detail.
 */
const readBagCode = (code: string): { orderId: string; send: string } | null => {
  if (!code.startsWith(BAG_CODE_PREFIX)) return null;
  const body = code.slice(BAG_CODE_PREFIX.length);
  if (!body) return null;

  const cut = body.lastIndexOf("-");
  const suffix = cut > 0 ? body.slice(cut + 1) : "";
  const hasIndex = cut > 0 && /^\d+$/.test(suffix);
  const ref = bareRef(hasIndex ? body.slice(0, cut) : body);
  if (!ref) return null;

  return {
    orderId: `${ORDER_PREFIX}${ref}`,
    send: `${BAG_CODE_PREFIX}${ref}-${hasIndex ? suffix : 1}`,
  };
};

/**
 * The canonical `D-XXXXXX-N` for anything a scanner or keyboard produced, or
 * null when it isn't a bag code at all. This is the only spelling that should
 * ever leave the device.
 */
export const canonicalBagCode = (raw?: string | null): string | null =>
  readBagCode(codeFromScan(raw))?.send ?? null;

/**
 * The order reference carried by a bag code, parsed exactly as the server does
 * it — last segment dropped as the bag index. Returns null for a code the
 * server would call unrecognised.
 */
export const orderIdFromBagCode = (raw: string): string | null =>
  readBagCode(codeFromScan(raw))?.orderId ?? null;

/** One verified bag, reported to the backend in the handover batch. */
export interface ScannedBag {
  stop_id: string;
  order_id: string;
  code: string;
}

export type BagRejection = "malformed" | "unknown" | "duplicate";

/**
 * `reason` is declared on the success arm too, as always-absent. The project
 * compiles with `strict: false`, and without strictNullChecks TypeScript will
 * not narrow a union by a boolean discriminant — so `if (!match.ok)` leaves
 * `match` as the whole union and reading `match.reason` is an error. Declaring
 * the key on both arms keeps the property addressable while still typing it as
 * absent on a successful match.
 */
export type BagMatch =
  | { ok: true; stop: TripStop; orderId: string; code: string; reason?: undefined }
  | { ok: false; reason: BagRejection; orderId: string | null; stop?: undefined; code?: undefined };

/**
 * Resolve a scanned code against the trip. The code alone decides which bag was
 * scanned — the rider may tap any row and scan whatever bag is in their hand.
 */
export const matchBagCode = (raw: string, stops: TripStop[], scanned: ScannedBag[] = []): BagMatch => {
  const reading = readBagCode(codeFromScan(raw));
  if (!reading) return { ok: false, reason: "malformed", orderId: null };

  const { orderId, send } = reading;
  const stop = stops.find(
    (s) => s.type === "dropoff" && normalizeOrderId(s.order_id) === orderId,
  );
  if (!stop) return { ok: false, reason: "unknown", orderId };
  if (stop.bag_scanned || scanned.some((b) => b.stop_id === stop.id)) {
    return { ok: false, reason: "duplicate", orderId };
  }
  // `send`, not the raw scan: the server re-parses this string and needs the
  // canonical form — bag index present, no URL wrapper, no FRSH spelling.
  return { ok: true, stop, orderId, code: send };
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
