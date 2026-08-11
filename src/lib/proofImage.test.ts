import { describe, expect, it } from "vitest";
import { buildProofStamp, fitWithin, MAX_PROOF_EDGE_PX, proofFileName } from "./proofImage";

describe("fitWithin", () => {
  it("brings a phone-camera frame down to the upload budget", () => {
    // 4000×3000 encodes to several MB; the rider pays for that in mobile data
    // at the customer's door.
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_PROOF_EDGE_PX, height: 960 });
  });

  it("fits by the long edge whichever way the phone was held", () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: MAX_PROOF_EDGE_PX });
  });

  it("leaves a frame that already fits exactly as it is", () => {
    // Upscaling a weak camera's output only makes a blurrier, larger file.
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("never rounds an edge away to nothing", () => {
    expect(fitWithin(4000, 3).height).toBeGreaterThanOrEqual(1);
  });

  it("survives a zero-sized frame instead of dividing by it", () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe("buildProofStamp", () => {
  it("states where the photo was taken, to about a metre", () => {
    const [, where] = buildProofStamp({
      capturedAt: "2026-08-11T09:15:00.000Z",
      latitude: 12.8940163,
      longitude: 77.6159921,
      accuracy: 12.4,
    });
    expect(where).toBe("12.89402, 77.61599 · ±12 m");
  });

  it("says so plainly when there was no fix, rather than printing a false one", () => {
    const [, where] = buildProofStamp({ capturedAt: "2026-08-11T09:15:00.000Z" });
    expect(where).toBe("Location unavailable");
  });

  it("omits the accuracy the device didn't report", () => {
    const [, where] = buildProofStamp({
      capturedAt: "2026-08-11T09:15:00.000Z",
      latitude: 12.9,
      longitude: 77.6,
      accuracy: null,
    });
    expect(where).toBe("12.90000, 77.60000");
  });

  it("puts a readable capture time on the first line", () => {
    const [when] = buildProofStamp({ capturedAt: "2026-08-11T09:15:00.000Z" });
    expect(when).toMatch(/2026/);
    expect(when).not.toBe("2026-08-11T09:15:00.000Z");
  });
});

describe("proofFileName", () => {
  it("names the file after the instant of capture", () => {
    expect(proofFileName("2026-08-11T09:15:00.000Z")).toBe("proof-2026-08-11T09-15-00-000Z.jpg");
  });
});
