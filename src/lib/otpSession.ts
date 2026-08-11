import { useCallback, useEffect, useState } from "react";

/**
 * Per-code OTP state that has to outlive the component showing it.
 *
 * Two separate OTPs exist in this app and both need the same three facts —
 * how long until another send is allowed, how many times the code has been
 * rejected, and how many times it has been resent:
 *
 * - the **rider's login code** (`/api/auth/send-otp/`), keyed by phone
 * - the **customer's handover code** (`/assignments/{id}/resend-otp/`), keyed by stop
 *
 * Component state cannot hold this. The proof drawer unmounts every time the
 * rider closes the sheet to call the customer, and a cooldown that resets on
 * close is not a cooldown — it is a button that looks disabled for as long as
 * you keep looking at it. The same goes for the failed-attempt count that
 * decides when the no-code fallback appears.
 *
 * Deliberately in-memory only. This is a courtesy to the SMS gateway and a
 * nudge to the rider, not a control: it dies with a reload, which is exactly
 * why the server must enforce its own limit (see docs/SERVER_CHANGES.md, S7).
 */

/** Cooldown after resending a customer's handover code. */
export const DELIVERY_RESEND_COOLDOWN_S = 45;

/** Cooldown after sending the rider their own login code. */
export const LOGIN_RESEND_COOLDOWN_S = 30;

export interface OtpProgress {
  /** Times the entered code has been rejected. */
  failures: number;
  /** Times a fresh code has been requested. */
  resends: number;
}

interface OtpRecord extends OtpProgress {
  /** Epoch ms before which another send is refused. */
  cooldownUntil: number;
}

const EMPTY: OtpRecord = { failures: 0, resends: 0, cooldownUntil: 0 };

const records = new Map<string, OtpRecord>();

const recordFor = (key: string): OtpRecord => records.get(key) ?? EMPTY;

/** Key for a customer's handover code. */
export const deliveryOtpKey = (stopId: string) => `stop:${stopId}`;

/** Key for a rider's own login code. */
export const loginOtpKey = (phone: string) => `login:${phone}`;

export function otpProgress(key: string | null): OtpProgress {
  if (!key) return { failures: 0, resends: 0 };
  const { failures, resends } = recordFor(key);
  return { failures, resends };
}

export function recordOtpFailure(key: string | null): void {
  if (!key) return;
  const current = recordFor(key);
  records.set(key, { ...current, failures: current.failures + 1 });
}

export function recordOtpResend(key: string | null, cooldownSeconds: number): void {
  if (!key) return;
  const current = recordFor(key);
  records.set(key, {
    ...current,
    resends: current.resends + 1,
    cooldownUntil: Date.now() + cooldownSeconds * 1000,
  });
}

/**
 * Seconds left on the lock, computed from a deadline rather than counted down.
 *
 * A decrementing counter stalls whenever the OS throttles timers — which is
 * precisely what happens when the rider backgrounds the app to read the SMS
 * they are waiting on, so the wait would appear to grow the longer they looked
 * away. A deadline is simply re-read on return.
 */
export function cooldownRemaining(key: string | null): number {
  if (!key) return 0;
  const remaining = recordFor(key).cooldownUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/** Forget a code entirely — it was accepted, or the rider moved on. */
export function clearOtpProgress(key: string | null): void {
  if (key) records.delete(key);
}

/** Test seam. Never called by the app. */
export function resetOtpSessions(): void {
  records.clear();
}

/**
 * Live view of one key: the seconds left, the progress counters, and writers
 * that keep the store and the render in step.
 */
export function useOtpSession(key: string | null) {
  const [remaining, setRemaining] = useState(() => cooldownRemaining(key));
  const [progress, setProgress] = useState<OtpProgress>(() => otpProgress(key));

  // Switching stops (or phone numbers) adopts that key's own history rather
  // than starting clean — the whole point of keeping it outside the component.
  useEffect(() => {
    setRemaining(cooldownRemaining(key));
    setProgress(otpProgress(key));
  }, [key]);

  const active = remaining > 0;
  useEffect(() => {
    if (!key || !active) return;
    const id = setInterval(() => setRemaining(cooldownRemaining(key)), 500);
    return () => clearInterval(id);
  }, [key, active]);

  const noteResend = useCallback(
    (cooldownSeconds: number) => {
      recordOtpResend(key, cooldownSeconds);
      setRemaining(cooldownRemaining(key));
      setProgress(otpProgress(key));
    },
    [key],
  );

  const noteFailure = useCallback(() => {
    recordOtpFailure(key);
    setProgress(otpProgress(key));
  }, [key]);

  const clear = useCallback(() => {
    clearOtpProgress(key);
    setRemaining(0);
    setProgress({ failures: 0, resends: 0 });
  }, [key]);

  return { remaining, ...progress, noteResend, noteFailure, clear };
}
