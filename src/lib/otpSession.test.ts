import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOtpProgress,
  cooldownRemaining,
  deliveryOtpKey,
  loginOtpKey,
  otpProgress,
  recordOtpFailure,
  recordOtpResend,
  resetOtpSessions,
} from "./otpSession";

beforeEach(() => {
  resetOtpSessions();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resend cooldown", () => {
  it("locks the key for the requested span", () => {
    recordOtpResend("stop:s1", 45);
    expect(cooldownRemaining("stop:s1")).toBe(45);
  });

  it("counts down in real time and expires", () => {
    recordOtpResend("stop:s1", 45);
    vi.advanceTimersByTime(30_000);
    expect(cooldownRemaining("stop:s1")).toBe(15);
    vi.advanceTimersByTime(15_000);
    expect(cooldownRemaining("stop:s1")).toBe(0);
  });

  it("keeps running while the app is backgrounded", () => {
    // The lock is a deadline, not a counter, so a throttled or suspended timer
    // can't stall it — the rider reading the SMS in another app must not come
    // back to a wait that never moved.
    recordOtpResend("stop:s1", 45);
    vi.advanceTimersByTime(60_000);
    expect(cooldownRemaining("stop:s1")).toBe(0);
  });

  it("never reports a negative wait", () => {
    recordOtpResend("stop:s1", 5);
    vi.advanceTimersByTime(500_000);
    expect(cooldownRemaining("stop:s1")).toBe(0);
  });

  it("locks each code separately", () => {
    recordOtpResend("stop:s1", 45);
    expect(cooldownRemaining("stop:s2")).toBe(0);
  });

  it("reads a key it has never seen as unlocked", () => {
    expect(cooldownRemaining("stop:never")).toBe(0);
    expect(cooldownRemaining(null)).toBe(0);
  });
});

describe("progress that outlives the sheet", () => {
  it("remembers failures across a close and reopen", () => {
    // Closing the drawer to call the customer used to reset the count that
    // unlocks the no-code fallback.
    recordOtpFailure("stop:s1");
    recordOtpFailure("stop:s1");
    expect(otpProgress("stop:s1").failures).toBe(2);
  });

  it("remembers resends, so the lock can't be shrugged off by reopening", () => {
    recordOtpResend("stop:s1", 45);
    vi.advanceTimersByTime(10_000);
    expect(otpProgress("stop:s1").resends).toBe(1);
    expect(cooldownRemaining("stop:s1")).toBe(35);
  });

  it("keeps failures and resends independent", () => {
    recordOtpFailure("stop:s1");
    recordOtpResend("stop:s1", 45);
    expect(otpProgress("stop:s1")).toEqual({ failures: 1, resends: 1 });
  });

  it("forgets a code once it is spent", () => {
    recordOtpFailure("stop:s1");
    recordOtpResend("stop:s1", 45);
    clearOtpProgress("stop:s1");
    expect(otpProgress("stop:s1")).toEqual({ failures: 0, resends: 0 });
    expect(cooldownRemaining("stop:s1")).toBe(0);
  });

  it("ignores writes with no key rather than throwing", () => {
    // A pickup stop has no customer code, so the drawer passes null.
    recordOtpFailure(null);
    recordOtpResend(null, 45);
    clearOtpProgress(null);
    expect(otpProgress(null)).toEqual({ failures: 0, resends: 0 });
  });
});

describe("keys", () => {
  it("keeps the two OTP systems in separate namespaces", () => {
    // The rider's login code and a customer's handover code must never share a
    // cooldown, even if the ids collide.
    expect(deliveryOtpKey("abc")).not.toBe(loginOtpKey("abc"));
    recordOtpResend(deliveryOtpKey("abc"), 45);
    expect(cooldownRemaining(loginOtpKey("abc"))).toBe(0);
  });
});
