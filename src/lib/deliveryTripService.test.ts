import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
const post = vi.fn();
vi.mock("./apiClient", () => ({ apiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) } }));

const { DeliveryTripService } = await import("./deliveryTripService");

const stop = (extra: Record<string, unknown> = {}) => ({
  id: "s1",
  type: "dropoff",
  label: "Ananya Rao",
  address: "12, 100 Feet Rd",
  latitude: 12.97,
  longitude: 77.64,
  sequence: 1,
  is_completed: false,
  bag_scanned: false,
  assignment: "a1",
  ...extra,
});

const tripWith = (dropStop: Record<string, unknown>) => ({
  id: "t1",
  status: "ASSIGNED",
  total_distance_km: 8,
  total_duration_min: 25,
  stop_count: 1,
  encoded_polyline: "",
  is_optimized: true,
  hub: null,
  stops: [dropStop],
});

describe("drop-off contact number", () => {
  beforeEach(() => { get.mockReset(); post.mockReset(); });

  it.each([
    ["customer_phone", "+91 98450 11234"],
    ["customer_mobile", "+91 98450 11234"],
    ["contact_number", "+91 98450 11234"],
    ["phone", "+91 98450 11234"],
  ])("resolves a number sent as %s", async (key, value) => {
    get.mockResolvedValue({ status: 200, data: { trip: tripWith(stop({ [key]: value })) } });
    const result = await DeliveryTripService.getActiveTrip();
    expect(result.data?.stops[0].customer_phone).toBe(value);
  });

  it("trims and accepts a numeric payload", async () => {
    get.mockResolvedValue({ status: 200, data: { trip: tripWith(stop({ phone: "  9845011234  " })) } });
    expect((await DeliveryTripService.getActiveTrip()).data?.stops[0].customer_phone).toBe("9845011234");

    get.mockResolvedValue({ status: 200, data: { trip: tripWith(stop({ phone: 9845011234 })) } });
    expect((await DeliveryTripService.getActiveTrip()).data?.stops[0].customer_phone).toBe("9845011234");
  });

  it("leaves it undefined when the payload carries no number", async () => {
    get.mockResolvedValue({ status: 200, data: { trip: tripWith(stop()) } });
    const result = await DeliveryTripService.getActiveTrip();
    expect(result.data?.stops[0].customer_phone).toBeUndefined();
  });

  it("survives a handover response, not just the initial load", async () => {
    post.mockResolvedValue({
      status: 200,
      data: { trip: tripWith(stop({ customer_phone: "+91 99016 55801", bag_scanned: true })) },
    });
    const result = await DeliveryTripService.confirmTripPickup("t1", [
      { stop_id: "s1", order_id: "FRSH-A434EB", code: "D-FRSH-A434EB" },
    ]);
    expect(result.data?.stops[0].customer_phone).toBe("+91 99016 55801");
  });

  it("reports every bag code alongside the trip it belongs to", async () => {
    post.mockResolvedValue({ status: 200, data: { trip: tripWith(stop()) } });
    const bags = [
      { stop_id: "s1", order_id: "FRSH-A434EB", code: "D-FRSH-A434EB" },
      { stop_id: "s2", order_id: "FRSH-B111CC", code: "D-FRSH-B111CC" },
    ];
    await DeliveryTripService.confirmTripPickup("t1", bags);
    expect(post).toHaveBeenCalledWith("/api/delivery-partner/trips/t1/pickup/", {
      trip_id: "t1",
      bags,
    });
  });

  it("ignores a blank string rather than showing an empty Call row", async () => {
    get.mockResolvedValue({ status: 200, data: { trip: tripWith(stop({ customer_phone: "   " })) } });
    expect((await DeliveryTripService.getActiveTrip()).data?.stops[0].customer_phone).toBeUndefined();
  });
});
