import { describe, expect, it } from "vitest";
import {
  ARRIVED_RADIUS_M,
  ACCURACY_ALLOWANCE_CAP_M,
  formatDistance,
  metresBetween,
  PROOF_UNLOCK_RADIUS_M,
  stopProximity,
} from "./stopProximity";

const DROP = { id: "s1", latitude: 12.9784, longitude: 77.6408 };

/** A point `metres` due north of the drop — pure latitude offset, no trig. */
const northOf = (metres: number, accuracy: number | null = 0) => ({
  latitude: DROP.latitude + metres / 111_320,
  longitude: DROP.longitude,
  accuracy,
});

describe("stopProximity", () => {
  it("locks the proof chain while the rider is still away", () => {
    const far = stopProximity(northOf(1200), DROP);
    expect(far.unlocked).toBe(false);
    expect(far.arrived).toBe(false);
    expect(far.awaitingFix).toBe(false);
    expect(far.distanceM).toBeGreaterThan(1000);
  });

  it("unlocks inside the radius and flags arrival closer in", () => {
    const approaching = stopProximity(northOf(PROOF_UNLOCK_RADIUS_M - 50), DROP);
    expect(approaching.unlocked).toBe(true);
    expect(approaching.arrived).toBe(false);

    const atDoor = stopProximity(northOf(ARRIVED_RADIUS_M - 50), DROP);
    expect(atDoor.unlocked).toBe(true);
    expect(atDoor.arrived).toBe(true);
  });

  it("forgives the fix's own error so drift can't strand a rider at the door", () => {
    const justOutside = PROOF_UNLOCK_RADIUS_M + 80;
    expect(stopProximity(northOf(justOutside, 0), DROP).unlocked).toBe(false);
    expect(stopProximity(northOf(justOutside, 100), DROP).unlocked).toBe(true);
  });

  it("caps the allowance, so a hopeless fix can't open the gate from anywhere", () => {
    const beyondCap = PROOF_UNLOCK_RADIUS_M + ACCURACY_ALLOWANCE_CAP_M + 100;
    expect(stopProximity(northOf(beyondCap, 5000), DROP).unlocked).toBe(false);
  });

  it("stays locked but marks itself as waiting when no fix has landed", () => {
    const noFix = stopProximity(null, DROP);
    expect(noFix.unlocked).toBe(false);
    expect(noFix.awaitingFix).toBe(true);
    expect(noFix.distanceM).toBeNull();
  });

  it("fails open for a stop dispatch sent without coordinates", () => {
    const noCoords = stopProximity(northOf(5000), { id: "s2", latitude: null, longitude: null });
    expect(noCoords.unlocked).toBe(true);
    expect(noCoords.distanceM).toBeNull();
  });
});

describe("metresBetween", () => {
  it("measures a known offset", () => {
    // `northOf` uses a flat metres-per-degree constant, so allow a metre of
    // slack against the great-circle figure the module actually computes.
    expect(metresBetween(northOf(500), DROP)).toBeCloseTo(500, -1);
  });
});

describe("formatDistance", () => {
  it("reads in metres up close and kilometres beyond", () => {
    expect(formatDistance(184)).toBe("180 m");
    expect(formatDistance(1240)).toBe("1.2 km");
  });
});
