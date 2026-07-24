import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("./apiClient", () => ({ apiClient: { post: (...a: unknown[]) => post(...a) } }));

const { DeliveryAssignmentService } = await import("./deliveryAssignmentService");

describe("markDelivered", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ status: 200, data: {} });
  });

  it("sends the cash-on-delivery flag the rider ticked", async () => {
    await DeliveryAssignmentService.markDelivered("a1", "s1", "otp", "123456", 12.9, 77.6, true);
    expect(post).toHaveBeenCalledWith(
      "/api/delivery-partner/assignments/a1/deliver/",
      expect.objectContaining({ stop_id: "s1", type: "otp", otp_code: "123456", cod_collected: true }),
    );
  });

  it("sends an explicit false rather than omitting it", async () => {
    await DeliveryAssignmentService.markDelivered("a1", "s1", "otp", "123456");
    expect(post.mock.calls[0][1]).toMatchObject({ cod_collected: false });
  });
});
