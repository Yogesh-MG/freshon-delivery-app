import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openGoogleMapsRoute, type LatLng } from "./mapsUtils";

/**
 * openGoogleMapsRoute calls openExternalUrl, which is defined in the SAME
 * module — an internal call, so vi.mock on the import cannot intercept it.
 * In jsdom there is no __TAURI_INTERNALS__ on window, so openExternalUrl
 * takes the plain-web branch and calls window.open. We spy on window.open
 * to capture the URL the function builds.
 */
let openSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  openSpy = vi.spyOn(window, "open").mockReturnValue({} as Window);
});

afterEach(() => {
  openSpy.mockRestore();
});

function capturedUrl(): string {
  expect(openSpy).toHaveBeenCalledTimes(1);
  return openSpy.mock.calls[0][0] as string;
}

const dest: LatLng = { lat: 13.0827, lng: 80.2707 };
const origin: LatLng = { lat: 12.9716, lng: 77.5946 };

describe("openGoogleMapsRoute", () => {
  it("builds the full dir URL with origin and no waypoints", () => {
    openGoogleMapsRoute({ origin, destination: dest });
    // URLSearchParams percent-encodes the comma; origin is appended after
    // the constructor params (api, destination, travelmode).
    expect(capturedUrl()).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=13.0827%2C80.2707&travelmode=driving&origin=12.9716%2C77.5946",
    );
  });

  it("opens the URL in a new tab with noopener,noreferrer", () => {
    openGoogleMapsRoute({ destination: dest });
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://www.google.com/maps/dir/?"),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("omits the origin param when origin is not provided (device location)", () => {
    openGoogleMapsRoute({ destination: dest });
    const params = new URL(capturedUrl()).searchParams;
    expect(params.has("origin")).toBe(false);
    expect(params.get("api")).toBe("1");
    expect(params.get("destination")).toBe("13.0827,80.2707");
    expect(params.get("travelmode")).toBe("driving");
  });

  it("omits the origin param when origin is null", () => {
    openGoogleMapsRoute({ origin: null, destination: dest });
    expect(new URL(capturedUrl()).searchParams.has("origin")).toBe(false);
  });

  it("joins multiple waypoints with | (percent-encoded as %7C)", () => {
    openGoogleMapsRoute({
      origin,
      destination: dest,
      waypoints: [
        { lat: 12.5, lng: 77.1 },
        { lat: 12.6, lng: 77.2 },
        { lat: 12.7, lng: 77.3 },
      ],
    });
    const url = capturedUrl();
    expect(url).toContain("waypoints=12.5%2C77.1%7C12.6%2C77.2%7C12.7%2C77.3");
    expect(new URL(url).searchParams.get("waypoints")).toBe(
      "12.5,77.1|12.6,77.2|12.7,77.3",
    );
  });

  it("omits the waypoints param for an empty waypoints array", () => {
    openGoogleMapsRoute({ destination: dest, waypoints: [] });
    expect(new URL(capturedUrl()).searchParams.has("waypoints")).toBe(false);
  });

  it("handles negative coordinates in origin, destination and waypoints", () => {
    openGoogleMapsRoute({
      origin: { lat: -33.86746, lng: -151.20709 },
      destination: { lat: -38.5, lng: 120.2 },
      waypoints: [{ lat: -12.5, lng: -77.1 }],
    });
    const params = new URL(capturedUrl()).searchParams;
    expect(params.get("origin")).toBe("-33.86746,-151.20709");
    expect(params.get("destination")).toBe("-38.5,120.2");
    expect(params.get("waypoints")).toBe("-12.5,-77.1");
  });

  it("filters out invalid waypoints but keeps valid ones", () => {
    openGoogleMapsRoute({
      destination: dest,
      waypoints: [
        { lat: 12.5, lng: 77.1 },
        { lat: NaN, lng: 77.2 }, // NaN → invalid
        { lat: 91, lng: 77.3 }, // lat out of range → invalid
        { lat: 12.8, lng: 181 }, // lng out of range → invalid
        null as unknown as LatLng, // nullish → invalid
        { lat: 12.9, lng: 77.4 },
      ],
    });
    expect(new URL(capturedUrl()).searchParams.get("waypoints")).toBe(
      "12.5,77.1|12.9,77.4",
    );
  });

  it("omits the waypoints param when every waypoint is invalid", () => {
    openGoogleMapsRoute({
      destination: dest,
      waypoints: [{ lat: NaN, lng: NaN }, { lat: 100, lng: 200 }],
    });
    expect(new URL(capturedUrl()).searchParams.has("waypoints")).toBe(false);
  });

  it("silently drops an invalid origin instead of throwing", () => {
    openGoogleMapsRoute({
      origin: { lat: 12.9716, lng: 181 }, // lng out of range
      destination: dest,
    });
    expect(new URL(capturedUrl()).searchParams.has("origin")).toBe(false);
  });

  it("accepts boundary coordinates (±90 lat, ±180 lng)", () => {
    openGoogleMapsRoute({
      origin: { lat: -90, lng: -180 },
      destination: { lat: 90, lng: 180 },
    });
    const params = new URL(capturedUrl()).searchParams;
    expect(params.get("origin")).toBe("-90,-180");
    expect(params.get("destination")).toBe("90,180");
  });

  it("throws for a missing or invalid destination without opening anything", () => {
    expect(() =>
      openGoogleMapsRoute({ destination: null as unknown as LatLng }),
    ).toThrow("Destination coordinates are missing or invalid");
    expect(() =>
      openGoogleMapsRoute({ destination: { lat: NaN, lng: 77.6 } }),
    ).toThrow("Destination coordinates are missing or invalid");
    expect(() =>
      openGoogleMapsRoute({ destination: { lat: 12.97, lng: 200 } }),
    ).toThrow("Destination coordinates are missing or invalid");
    expect(openSpy).not.toHaveBeenCalled();
  });
});
