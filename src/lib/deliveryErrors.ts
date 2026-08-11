/**
 * Reading the server's refusal well enough to act on it.
 *
 * `deliver/` can refuse for reasons that call for opposite responses from the
 * rider: a wrong code means re-enter it, being outside the geofence means walk
 * closer, a dead connection means wait and retry. All three arrived as the same
 * transient toast, which told the rider that something failed and nothing about
 * what to do next.
 *
 * The backend does not send a machine-readable code, so this reads the prose.
 * That is a stopgap and it is why `deliver/` should return a stable
 * `error_code` — see docs/DELIVERY_API.md § "Required server changes". Anything
 * unrecognised falls through to `unknown`, where the message is shown as-is.
 */
export type DeliveryFailure = "otp" | "location" | "state" | "network" | "unknown";

const PATTERNS: [DeliveryFailure, RegExp][] = [
  // "Can't reach the server…" is this app's own offline copy (see apiClient).
  ["network", /can'?t reach the server|network|offline|timed? ?out|failed to fetch/i],
  ["otp", /\botp\b|verification code|wrong code|invalid code|incorrect code|code (?:is )?(?:invalid|incorrect|expired)|expired code/i],
  ["location", /geofence|too far|not (?:near|at) the|outside the|within \d+\s?m|location (?:required|missing)|distance/i],
  ["state", /already (?:delivered|completed)|not (?:picked up|in transit)|confirm .*pickup|invalid (?:state|status)/i],
];

export function classifyDeliveryError(message?: string | null): DeliveryFailure {
  if (!message) return "unknown";
  for (const [failure, pattern] of PATTERNS) {
    if (pattern.test(message)) return failure;
  }
  return "unknown";
}

/**
 * What the rider should do about it, in their own terms. The server's own
 * wording is preferred where it is specific; these fill the gap where it is not
 * and, for the network case, where it cannot know.
 */
export function deliveryFailureHint(failure: DeliveryFailure): string | null {
  switch (failure) {
    case "otp":
      return "Check the code with the customer, or resend it.";
    case "location":
      return "Move closer to the address and try again.";
    case "network":
      return "Your photo is saved — try again once you have signal.";
    case "state":
      return "Pull down to refresh this trip.";
    default:
      return null;
  }
}
