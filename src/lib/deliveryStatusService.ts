import { apiClient } from "./apiClient";
import { ApiResult, EarningsStats } from "./types";

export interface ProofUpload {
  /** The owning assignment. Sent as `mission_id` — the field name the API uses. */
  missionId: string;
  /**
   * Which drop-off this photo evidences. One assignment can cover more than one
   * stop, and without this the proof can only be attributed to the assignment.
   */
  stopId?: string;
  photo: File;
  /** ISO-8601 instant the frame was taken, not the instant it was uploaded. */
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number | null;
}

/** How many times a proof upload is attempted before the rider is told. */
export const PROOF_UPLOAD_ATTEMPTS = 3;

/**
 * A stable id for one captured frame, identical across every retry of it.
 *
 * Retrying is what makes this necessary: a request whose response was lost has
 * still been processed, and without a key the server stores the same doorstep
 * twice. Derived rather than random so it survives the app being reloaded
 * mid-retry, and scoped to the stop so two doors never collide.
 */
export function captureId(proof: Pick<ProofUpload, "missionId" | "stopId" | "capturedAt">): string {
  return [proof.stopId || proof.missionId, proof.capturedAt || "unknown"].join(":");
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Worth another attempt? A refused connection or a 5xx is the network or the
 * server having a moment — the same bytes may well land a second later. A 4xx
 * is a considered refusal (too large, wrong type, not your assignment) and
 * retrying it only wastes the rider's data and their time at the door.
 */
const isTransient = (status: number) => status === 0 || status === 408 || status === 429 || status >= 500;

export class DeliveryStatusService {
  static async updateStatus(online: boolean, latitude?: number, longitude?: number): Promise<ApiResult<{ online: boolean }>> {
    const response = await apiClient.patch<{ online: boolean }>("/api/delivery-partner/status/", {
      online,
      latitude,
      longitude,
    });
    if (response.error) return { success: false, error: response.error, errorCode: response.errorCode };
    return { success: true, data: response.data };
  }

  static async getEarnings(): Promise<ApiResult<EarningsStats>> {
    const response = await apiClient.get<EarningsStats>("/api/delivery-partner/earnings/");
    if (response.error) return { success: false, error: response.error, errorCode: response.errorCode };
    return { success: true, data: response.data };
  }

  /**
   * Upload one proof-of-delivery photo.
   *
   * Retried on transient failures because the alternative is a rider standing
   * at a door they have already handed the parcel over at, unable to close the
   * stop because a lift lobby ate one request. The body is rebuilt per attempt:
   * a FormData that has been handed to fetch once must not be reused.
   */
  static async uploadProof(
    proof: ProofUpload,
    attempts = PROOF_UPLOAD_ATTEMPTS,
  ): Promise<ApiResult<{ url: string }>> {
    let lastError = "Photo upload failed";
    let lastCode: string | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const formData = new FormData();
      formData.append("mission_id", proof.missionId);
      formData.append("photo", proof.photo);
      formData.append("capture_id", captureId(proof));
      if (proof.stopId) formData.append("stop_id", proof.stopId);
      if (proof.capturedAt) formData.append("captured_at", proof.capturedAt);
      if (proof.latitude != null) formData.append("latitude", String(proof.latitude));
      if (proof.longitude != null) formData.append("longitude", String(proof.longitude));
      if (proof.accuracyM != null) formData.append("accuracy_m", String(proof.accuracyM));

      const response = await apiClient.post<{ url: string }>("/api/delivery-partner/proof/", formData);
      if (!response.error) return { success: true, data: response.data };

      lastError = response.error;
      lastCode = response.errorCode;
      if (!isTransient(response.status) || attempt === attempts) break;
      // 400 ms, then 800 ms. Long enough to outlast a handover between cells,
      // short enough that the rider isn't left holding the phone.
      await delay(400 * attempt);
    }

    return { success: false, error: lastError, errorCode: lastCode };
  }
}
