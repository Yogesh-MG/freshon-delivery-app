import { describe, expect, it } from "vitest";
import { classifyDeliveryError, deliveryFailureHint } from "./deliveryErrors";

describe("classifyDeliveryError", () => {
  it("reads a rejected code as an OTP failure", () => {
    // Only this class of failure should clear the boxes the rider typed.
    expect(classifyDeliveryError("Incorrect OTP. Ask the customer to read the code again.")).toBe("otp");
    expect(classifyDeliveryError("Invalid code")).toBe("otp");
    expect(classifyDeliveryError("The verification code has expired")).toBe("otp");
  });

  it("reads a geofence refusal as a location failure", () => {
    expect(classifyDeliveryError("You are too far from the delivery address")).toBe("location");
    expect(classifyDeliveryError("Must be within 300m of the drop")).toBe("location");
    expect(classifyDeliveryError("Geofence check failed")).toBe("location");
  });

  it("recognises the app's own offline copy", () => {
    expect(classifyDeliveryError("Can't reach the server. Check your connection and try again.")).toBe("network");
  });

  it("reads a lifecycle refusal as a state failure", () => {
    expect(classifyDeliveryError("This stop is already delivered")).toBe("state");
    expect(classifyDeliveryError("Confirm hub pickup before delivering")).toBe("state");
  });

  it("falls through to unknown rather than guessing", () => {
    expect(classifyDeliveryError("Request failed")).toBe("unknown");
    expect(classifyDeliveryError(undefined)).toBe("unknown");
    expect(classifyDeliveryError("")).toBe("unknown");
  });

  it("does not mistake a location refusal for a code one", () => {
    // Both mention the delivery; only one is about what the rider typed.
    expect(classifyDeliveryError("Too far from the drop to deliver")).toBe("location");
  });
});

describe("deliveryFailureHint", () => {
  it("tells the rider to act differently for each failure", () => {
    expect(deliveryFailureHint("otp")).toMatch(/resend|customer/i);
    expect(deliveryFailureHint("location")).toMatch(/closer/i);
    expect(deliveryFailureHint("network")).toMatch(/saved/i);
  });

  it("stays silent when it has nothing to add to the server's own words", () => {
    expect(deliveryFailureHint("unknown")).toBeNull();
  });
});
