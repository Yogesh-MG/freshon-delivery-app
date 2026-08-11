import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("./apiClient", () => ({ apiClient: { post: (...a: unknown[]) => post(...a) } }));

const { DeliveryStatusService } = await import("./deliveryStatusService");

const photo = () => new File(["x"], "proof.jpg", { type: "image/jpeg" });

const fieldsOf = (call: number): Record<string, string> => {
  const form = post.mock.calls[call][1] as FormData;
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    out[key] = value instanceof File ? value.name : String(value);
  });
  return out;
};

describe("uploadProof", () => {
  beforeEach(() => post.mockReset());

  it("attributes the photo to a stop, not just an assignment", async () => {
    // One assignment can cover more than one stop; without stop_id the photo
    // can't be tied to the door it was taken at.
    post.mockResolvedValue({ status: 200, data: { url: "https://cdn/p.jpg" } });
    await DeliveryStatusService.uploadProof({ missionId: "a1", stopId: "s1", photo: photo() });
    expect(fieldsOf(0)).toMatchObject({ mission_id: "a1", stop_id: "s1", photo: "proof.jpg" });
  });

  it("carries when and where the frame was taken", async () => {
    // A canvas capture has no EXIF at all, so provenance has to be sent beside it.
    post.mockResolvedValue({ status: 200, data: { url: "https://cdn/p.jpg" } });
    await DeliveryStatusService.uploadProof({
      missionId: "a1",
      photo: photo(),
      capturedAt: "2026-08-11T09:15:00.000Z",
      latitude: 12.894016,
      longitude: 77.615992,
      accuracyM: 12,
    });
    expect(fieldsOf(0)).toMatchObject({
      captured_at: "2026-08-11T09:15:00.000Z",
      latitude: "12.894016",
      longitude: "77.615992",
      accuracy_m: "12",
    });
  });

  it("retries a server-side failure and succeeds on a later attempt", async () => {
    post
      .mockResolvedValueOnce({ status: 502, error: "Bad gateway" })
      .mockResolvedValueOnce({ status: 200, data: { url: "https://cdn/p.jpg" } });

    const result = await DeliveryStatusService.uploadProof({ missionId: "a1", photo: photo() });

    expect(result.success).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("sends the same capture id on every retry so a lost response can't duplicate the row", async () => {
    post
      .mockResolvedValueOnce({ status: 500, error: "Server error" })
      .mockResolvedValueOnce({ status: 200, data: { url: "https://cdn/p.jpg" } });

    await DeliveryStatusService.uploadProof({
      missionId: "a1",
      stopId: "s1",
      photo: photo(),
      capturedAt: "2026-08-11T09:15:00.000Z",
    });

    expect(fieldsOf(0).capture_id).toBe("s1:2026-08-11T09:15:00.000Z");
    expect(fieldsOf(1).capture_id).toBe(fieldsOf(0).capture_id);
  });

  it("rebuilds the body per attempt rather than reusing a consumed FormData", async () => {
    post
      .mockResolvedValueOnce({ status: 0, error: "Can't reach the server." })
      .mockResolvedValueOnce({ status: 200, data: { url: "https://cdn/p.jpg" } });

    await DeliveryStatusService.uploadProof({ missionId: "a1", stopId: "s1", photo: photo() });

    expect(post.mock.calls[0][1]).not.toBe(post.mock.calls[1][1]);
    expect(fieldsOf(1)).toMatchObject({ mission_id: "a1", stop_id: "s1" });
  });

  it("does not retry a considered refusal", async () => {
    // A 413 is not going to become a 200 by asking again; retrying only spends
    // the rider's data while they stand at the door.
    post.mockResolvedValue({ status: 413, error: "Photo too large" });

    const result = await DeliveryStatusService.uploadProof({ missionId: "a1", photo: photo() });

    expect(result).toEqual({ success: false, error: "Photo too large" });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("gives up after the attempt budget and reports the last error", async () => {
    post.mockResolvedValue({ status: 500, error: "Server error" });

    const result = await DeliveryStatusService.uploadProof({ missionId: "a1", photo: photo() }, 3);

    expect(result).toEqual({ success: false, error: "Server error" });
    expect(post).toHaveBeenCalledTimes(3);
  });
});
