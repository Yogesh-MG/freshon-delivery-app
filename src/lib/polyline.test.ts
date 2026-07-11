import { describe, it, expect } from "vitest";
import { decodePolyline } from "./polyline";

/**
 * Reference encoder implementing the standard Google polyline algorithm
 * (test helper only — mirrors the inverse of decodePolyline, 1e5 precision).
 * Used for round-trip sanity checks.
 */
function encodePolyline(points: [number, number][]): string {
  const encodeValue = (v: number): string => {
    let value = v < 0 ? ~(v << 1) : v << 1;
    let out = "";
    while (value >= 0x20) {
      out += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    out += String.fromCharCode(value + 63);
    return out;
  };

  let lastLat = 0;
  let lastLng = 0;
  let out = "";
  for (const [lat, lng] of points) {
    const latE5 = Math.round(lat * 1e5);
    const lngE5 = Math.round(lng * 1e5);
    out += encodeValue(latE5 - lastLat) + encodeValue(lngE5 - lastLng);
    lastLat = latE5;
    lastLng = lngE5;
  }
  return out;
}

describe("decodePolyline", () => {
  it("decodes the canonical Google documentation example as [lat, lng] pairs", () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const decoded = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(decoded).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it("returns [] for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });

  it("decodes a single-point encoding", () => {
    expect(decodePolyline("_p~iF~ps|U")).toEqual([[38.5, -120.2]]);
  });

  it("decodes a single point in the FreshOn service area (Bengaluru)", () => {
    const decoded = decodePolyline("sqdnAq_rxM");
    expect(decoded).toHaveLength(1);
    expect(decoded[0][0]).toBeCloseTo(12.97194, 5);
    expect(decoded[0][1]).toBeCloseTo(77.59369, 5);
  });

  it("decodes points where both lat and lng are negative", () => {
    const decoded = decodePolyline("rvumEhs{y[jjEtcQ");
    expect(decoded).toHaveLength(2);
    expect(decoded[0][0]).toBeCloseTo(-33.86746, 5);
    expect(decoded[0][1]).toBeCloseTo(-151.20709, 5);
    expect(decoded[1][0]).toBeCloseTo(-33.9, 5);
    expect(decoded[1][1]).toBeCloseTo(-151.3, 5);
  });

  it("decodes a point with negative lat and positive lng", () => {
    const decoded = decodePolyline("~o~iF_qs|U");
    expect(decoded).toHaveLength(1);
    expect(decoded[0][0]).toBeCloseTo(-38.5, 5);
    expect(decoded[0][1]).toBeCloseTo(120.2, 5);
  });

  it("decodes the origin (0, 0)", () => {
    expect(decodePolyline("??")).toEqual([[0, 0]]);
  });

  it("resolves tiny 1e-5 deltas between consecutive points (delta encoding)", () => {
    // Encoded from [12.34567, 76.54321] then [12.34568, 76.54320]
    const decoded = decodePolyline("mgjjAazdrMA@");
    expect(decoded).toHaveLength(2);
    expect(decoded[0][0]).toBeCloseTo(12.34567, 5);
    expect(decoded[0][1]).toBeCloseTo(76.54321, 5);
    expect(decoded[1][0]).toBeCloseTo(12.34568, 5);
    expect(decoded[1][1]).toBeCloseTo(76.5432, 5);
  });

  it("round-trips arbitrary routes at 5-decimal precision", () => {
    const route: [number, number][] = [
      [12.9716, 77.5946], // Bengaluru
      [13.0827, 80.2707], // Chennai
      [-0.00001, 0.00001], // near origin, mixed signs
      [89.99999, 179.99999], // near the poles / antimeridian
      [-89.99999, -179.99999],
    ];
    const decoded = decodePolyline(encodePolyline(route));
    expect(decoded).toHaveLength(route.length);
    decoded.forEach(([lat, lng], i) => {
      expect(lat).toBeCloseTo(route[i][0], 5);
      expect(lng).toBeCloseTo(route[i][1], 5);
    });
  });

  it("returns tuples of exactly two numbers", () => {
    const decoded = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    for (const point of decoded) {
      expect(point).toHaveLength(2);
      expect(typeof point[0]).toBe("number");
      expect(typeof point[1]).toBe("number");
    }
  });
});
