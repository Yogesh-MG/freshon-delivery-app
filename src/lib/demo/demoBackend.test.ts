import { describe, expect, it } from "vitest";
import { handleDemoRequest } from "./demoBackend";
import type { DeliveryTrip } from "../deliveryTripService";

const get = <T>(path: string) => handleDemoRequest<T>(path, "GET", null);
const post = <T>(path: string, body?: unknown) =>
  handleDemoRequest<T>(path, "POST", body === undefined ? null : JSON.stringify(body));

/**
 * Walks the exact sequence the UI issues, in order, against the shared module
 * state — the point of the demo backend is that this whole chain reaches
 * COMPLETED without a server, so the test mirrors it end to end.
 */
describe("demo backend rider flow", () => {
  it("runs pool → accept → scan → pickup → deliver → complete", async () => {
    const pool = await get<{ trips: DeliveryTrip[] }>("/api/delivery-partner/trips/available/");
    const offered = pool!.data!.trips;
    expect(offered.length).toBeGreaterThan(0);

    const target = offered.find((t) => t.stops.filter((s) => s.type === "dropoff").length === 3)!;
    const accepted = await post<{ trip: DeliveryTrip }>(`/api/delivery-partner/trips/${target.id}/accept/`);
    expect(accepted!.data!.trip.status).toBe("ASSIGNED");

    // The pool empties while a trip is held, and the trip is now the active one.
    expect((await get<{ trips: DeliveryTrip[] }>("/api/delivery-partner/trips/available/"))!.data!.trips).toHaveLength(0);
    expect((await get<{ trip: DeliveryTrip }>("/api/delivery-partner/trips/active/"))!.data!.trip.id).toBe(target.id);

    // Pickup is refused until every bag code is in the batch — the gate the UI
    // relies on. Codes are the order id behind a "D-" prefix, nothing else.
    const bags = target.stops
      .filter((s) => s.type === "dropoff")
      .map((s) => ({ stop_id: s.id, order_id: s.order_id!, code: `D-${s.order_id}` }));

    const early = await post(`/api/delivery-partner/trips/${target.id}/pickup/`, {
      trip_id: target.id,
      bags: bags.slice(0, 2),
    });
    expect(early!.error).toMatch(/unscanned/);

    // A bag belonging to some other trip is refused outright.
    const foreign = await post(`/api/delivery-partner/trips/${target.id}/pickup/`, {
      trip_id: target.id,
      bags: [...bags.slice(0, 2), { stop_id: "x", order_id: "FRSH-NOPE", code: "D-FRSH-NOPE" }],
    });
    expect(foreign!.error).toMatch(/isn't on this trip/);

    const picked = await post<{ trip: DeliveryTrip }>(`/api/delivery-partner/trips/${target.id}/pickup/`, {
      trip_id: target.id,
      bags,
    });
    expect(picked!.data!.trip.status).toBe("ACTIVE");
    expect(picked!.data!.trip.stops.filter((s) => s.type === "dropoff" && s.bag_scanned)).toHaveLength(3);

    const drops = picked!.data!.trip.stops.filter((s) => s.type === "dropoff");
    for (const stop of drops) {
      const delivered = await post(`/api/delivery-partner/assignments/${stop.assignment}/deliver/`, {
        stop_id: stop.id,
        type: "otp",
        otp_code: "000000",
      });
      expect(delivered!.error).toBeUndefined();
    }

    // Last drop-off closes the trip out and hands the rider back to the pool.
    expect((await get<{ trip: DeliveryTrip | null }>("/api/delivery-partner/trips/active/"))!.data!.trip).toBeNull();
    expect((await get<{ trips: DeliveryTrip[] }>("/api/delivery-partner/trips/available/"))!.data!.trips.length).toBeGreaterThan(0);
  });

  it("leaves unknown endpoints to the real network", async () => {
    expect(await get("/api/something/else/")).toBeNull();
  });
});
