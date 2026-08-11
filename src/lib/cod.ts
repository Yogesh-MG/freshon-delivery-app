/**
 * Cash on delivery, as the rider's screen needs it.
 *
 * The app has only ever known whether the rider *said* they took cash, never
 * how much was due. A boolean cannot be reconciled against a cash drop, and it
 * cannot tell a prepaid order from a COD one — which is why the "collected?"
 * tick appeared on every door, including the ones with nothing to collect.
 *
 * `cod_amount` on the stop settles both questions, so everything here keys off
 * it. The backend does not send it yet; until it does, `parseCodAmount` returns
 * null and the drawer falls back to the old tick rather than silently dropping
 * the rider's only way to record cash.
 */

/**
 * Amount due at this door, or null when there is none to collect.
 *
 * Accepts a string because the wallet endpoints send decimals as strings and
 * this field is likely to follow. Zero, negatives and unparseable values all
 * read as "nothing due" — none of them is an amount a rider can collect.
 */
export function parseCodAmount(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  const value = typeof raw === "number" ? raw : Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * True when the backend told us about this stop's payment at all.
 *
 * The distinction that matters: `null` is "prepaid, nothing to collect", while
 * an absent field is "this backend has not shipped the change yet". The first
 * hides the cash prompt, the second has to leave it alone.
 */
export function hasCodField(raw: number | string | null | undefined): boolean {
  return raw !== undefined;
}

/** "₹1,240" / "₹1,240.50" — paise only when they are actually there. */
export function formatRupees(amount: number): string {
  const whole = Number.isInteger(amount);
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
