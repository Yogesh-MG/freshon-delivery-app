import { describe, expect, it } from "vitest";
import { ROAD_DETOUR_FACTOR, haversineKm, hubLatLng, tripParcelCount, tripWeightKg } from "./tripDistance";
import { tripKm } from "./deliveryTripService";
import type { DeliveryTrip } from "./deliveryTripService";

const HUB = { lat: 12.9352, lng: 77.6245 }; // Koramangala
const INDIRANAGAR = { lat: 12.9784, lng: 77.6408 };

const trip = (overrides: Partial<DeliveryTrip> = {}): DeliveryTrip => ({
  id: "t1",
  status: "PENDING",
  total_distance_km: "14.2",
  total_duration_min: 46,
  stop_count: 2,
  encoded_polyline: "",
  is_optimized: true,
  hub: { label: "Hub", address: "", latitude: HUB.lat, longitude: HUB.lng },
  stops: [
    {
      id: "s1",
      type: "dropoff",
      label: "A",
      address: "",
      latitude: INDIRANAGAR.lat,
      longitude: INDIRANAGAR.lng,
      sequence: 1,
      is_completed: false,
      bag_scanned: false,
      assignment: "a1",
      items: [{ name: "Mangoes", qty: 2, unit: "kg", weight_grams: 1000 }],
    },
  ],
  ...overrides,
});

describe("haversineKm", () => {
  it("measures a known Bengaluru hop", () => {
    // Koramangala → Indiranagar. Cross-check by flat approximation:
    //   Δlat 0.0432° × 111.32          = 4.81 km
    //   Δlng 0.0163° × 111.32 × cos12.95° = 1.77 km
    //   √(4.81² + 1.77²)               ≈ 5.12 km
    expect(haversineKm(HUB, INDIRANAGAR)).toBeCloseTo(5.12, 1);
  });

  it("is zero for a point against itself and symmetric", () => {
    expect(haversineKm(HUB, HUB)).toBe(0);
    expect(haversineKm(HUB, INDIRANAGAR)).toBeCloseTo(haversineKm(INDIRANAGAR, HUB), 6);
  });
});

describe("hubLatLng", () => {
  it("returns null when the hub has no coordinates", () => {
    expect(hubLatLng(trip({ hub: { label: "Hub", address: "", latitude: null, longitude: null } }))).toBeNull();
    expect(hubLatLng(trip({ hub: null }))).toBeNull();
  });
});

describe("tripWeightKg", () => {
  it("sums item weight × qty and adds the packaging overhead", () => {
    // 2 × 1000 g = 2 kg of goods, + 1 kg packaging.
    expect(tripWeightKg(trip())).toBeCloseTo(3, 5);
  });

  it("is null when nothing reports a weight, so the UI can say so", () => {
    const noWeights = trip();
    noWeights.stops[0].items = [{ name: "Mangoes", qty: 2, unit: "kg", weight_grams: null }];
    expect(tripWeightKg(noWeights)).toBeNull();

    noWeights.stops[0].items = [];
    expect(tripWeightKg(noWeights)).toBeNull();
  });
});

/**
 * Verbatim slice of a real GET /trips/available/ response, so the shape the
 * backend actually sends is pinned by a test rather than assumed.
 */
const LIVE_TRIP = {
  id: "c2fcc60c-4dc1-4bd7-96e3-3964849c95d3",
  status: "PENDING",
  total_distance_km: "14.46",
  total_duration_min: 39,
  stop_count: 1,
  encoded_polyline: "",
  is_optimized: true,
  earnings: 126.76,
  hub: { label: "FreshOn Main Hub", address: "", latitude: 12.965584, longitude: 77.50456 },
  stops: [
    {
      id: "hub-71a9c5b2",
      type: "pickup",
      label: "FreshOn Main Hub",
      address: "",
      latitude: 12.965584,
      longitude: 77.50456,
      sequence: 0,
      is_completed: false,
      customer: "",
      eta: "",
      notes: "",
      assignment: null,
      order_id: null,
      customer_phone: "",
      weight_kg: null,
      parcel_count: 0,
    },
    {
      id: "322bf49c",
      type: "dropoff",
      label: "Current Location",
      address: "Devarachikkanahalli",
      customer: "Shailaja Manjunath",
      eta: "",
      notes: "",
      latitude: 12.894016,
      longitude: 77.615992,
      sequence: 1,
      is_completed: false,
      assignment: "483840a5",
      bag_scanned: false,
      order_id: "FRSH-2FC946",
      customer_phone: "9900242455",
      weight_kg: 8.21,
      parcel_count: 9,
    },
  ],
} as unknown as DeliveryTrip;

describe("the live trips/available payload", () => {
  it("reads weight from weight_kg, counting drop-offs only", () => {
    // 8.21 from the drop-off; the hub's null must not become a 0 or an NaN.
    expect(tripWeightKg(LIVE_TRIP)).toBeCloseTo(8.21, 5);
  });

  it("does not add packaging overhead on top of a backend weight", () => {
    // The +1 kg only applies to the derived item-manifest path.
    expect(tripWeightKg(LIVE_TRIP)).toBeLessThan(9);
  });

  it("sums parcels across drop-offs", () => {
    expect(tripParcelCount(LIVE_TRIP)).toBe(9);
  });

  it("coerces the decimal-string distance", () => {
    expect(tripKm(LIVE_TRIP)).toBeCloseTo(14.46, 5);
    // The raw field is a string — .toFixed() on it would throw.
    expect(typeof LIVE_TRIP.total_distance_km).toBe("string");
  });

  it("still reports a weight when the item manifest is absent", () => {
    expect(LIVE_TRIP.stops.every((s) => s.items === undefined)).toBe(true);
    expect(tripWeightKg(LIVE_TRIP)).not.toBeNull();
  });
});

describe("quoted distance", () => {
  it("adds the approach leg to the backend's hub→drops figure", () => {
    const t = trip();
    const rider = { lat: 12.9318, lng: 77.6206 };
    const approach = haversineKm(rider, HUB) * ROAD_DETOUR_FACTOR;

    // What useTripDistance computes before OSRM answers.
    const total = approach + tripKm(t);
    expect(total).toBeGreaterThan(tripKm(t));
    expect(approach).toBeGreaterThan(0);
  });
});
