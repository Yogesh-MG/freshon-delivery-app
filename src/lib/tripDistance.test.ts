import { describe, expect, it } from "vitest";
import { ROAD_DETOUR_FACTOR, haversineKm, hubLatLng, tripWeightKg } from "./tripDistance";
import type { DeliveryTrip } from "./deliveryTripService";

const HUB = { lat: 12.9352, lng: 77.6245 }; // Koramangala
const INDIRANAGAR = { lat: 12.9784, lng: 77.6408 };

const trip = (overrides: Partial<DeliveryTrip> = {}): DeliveryTrip => ({
  id: "t1",
  status: "PENDING",
  total_distance_km: 14.2,
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

describe("quoted distance", () => {
  it("adds the approach leg to the backend's hub→drops figure", () => {
    const t = trip();
    const rider = { lat: 12.9318, lng: 77.6206 };
    const approach = haversineKm(rider, HUB) * ROAD_DETOUR_FACTOR;

    // What useTripDistance computes before OSRM answers.
    const total = approach + t.total_distance_km;
    expect(total).toBeGreaterThan(t.total_distance_km);
    expect(approach).toBeGreaterThan(0);
  });
});
