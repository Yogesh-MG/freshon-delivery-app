import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("./apiClient", () => ({ apiClient: { post: (...a: unknown[]) => post(...a) } }));

const { DeliveryAssignmentService } = await import("./deliveryAssignmentService");

const body = () => post.mock.calls[0][1] as Record<string, unknown>;

describe("markDelivered", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ status: 200, data: {} });
  });

  it("sends the cash-on-delivery flag the rider ticked", async () => {
    await DeliveryAssignmentService.markDelivered("a1", {
      stopId: "s1",
      type: "otp",
      otpCode: "123456",
      latitude: 12.9,
      longitude: 77.6,
      codCollected: true,
    });
    expect(post).toHaveBeenCalledWith(
      "/api/delivery-partner/assignments/a1/deliver/",
      expect.objectContaining({ stop_id: "s1", type: "otp", otp_code: "123456", cod_collected: true }),
    );
  });

  it("sends an explicit false rather than omitting it", async () => {
    await DeliveryAssignmentService.markDelivered("a1", { stopId: "s1", type: "otp", otpCode: "123456" });
    expect(body()).toMatchObject({ cod_collected: false });
  });

  it("sends the amount collected, not just that cash changed hands", async () => {
    // A boolean can't be reconciled against a cash drop; the amount can.
    await DeliveryAssignmentService.markDelivered("a1", {
      stopId: "s1",
      type: "otp",
      otpCode: "123456",
      codCollected: true,
      codAmount: 640,
    });
    expect(body()).toMatchObject({ cod_collected: true, cod_amount: 640 });
  });

  it("declares that a photo was captured, which `type` alone cannot say", async () => {
    await DeliveryAssignmentService.markDelivered("a1", {
      stopId: "s1",
      type: "otp",
      otpCode: "123456",
      photoCaptured: true,
      proofUrl: "https://cdn/proof.jpg",
    });
    expect(body()).toMatchObject({ type: "otp", photo_captured: true, proof_url: "https://cdn/proof.jpg" });
  });

  it("marks the no-code path as an exception rather than a plain photo delivery", async () => {
    await DeliveryAssignmentService.markDelivered("a1", {
      stopId: "s1",
      type: "photo",
      photoCaptured: true,
      exceptionReason: "OTP_UNAVAILABLE",
    });
    expect(body()).toMatchObject({ type: "photo", exception_reason: "OTP_UNAVAILABLE" });
  });

  it("omits the fields it knows nothing about instead of sending nulls", async () => {
    await DeliveryAssignmentService.markDelivered("a1", { stopId: "s1", type: "otp", otpCode: "123456" });
    expect(body()).not.toHaveProperty("cod_amount");
    expect(body()).not.toHaveProperty("exception_reason");
    expect(body()).not.toHaveProperty("proof_url");
    expect(body()).not.toHaveProperty("accuracy_m");
  });

  it("passes the fix's accuracy so the server can weigh its own geofence", async () => {
    await DeliveryAssignmentService.markDelivered("a1", {
      stopId: "s1",
      type: "otp",
      otpCode: "123456",
      latitude: 12.9,
      longitude: 77.6,
      accuracyM: 18,
    });
    expect(body()).toMatchObject({ accuracy_m: 18 });
  });
});
