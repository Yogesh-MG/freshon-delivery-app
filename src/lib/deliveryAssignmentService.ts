import { apiClient } from "./apiClient";
import { ApiResult, Assignment } from "./types";

/** Why a delivery was closed without the customer's code. */
export type DeliveryException = "OTP_UNAVAILABLE";

export interface DeliveryProof {
  stopId: string;
  /**
   * What the customer's end of the handover is evidenced by. `"otp"` is the
   * normal path; `"photo"` is the exception path, and always carries an
   * `exceptionReason` saying why the code could not be used.
   */
  type: "otp" | "photo";
  otpCode?: string;
  latitude?: number;
  longitude?: number;
  /** Horizontal accuracy of the fix above, so the server can weigh its own geofence. */
  accuracyM?: number | null;
  /** Whether the rider took cash at the door. */
  codCollected?: boolean;
  /**
   * How much cash was taken, in rupees. A boolean cannot be reconciled against
   * a cash drop; the amount can. Omitted when the stop carried no COD due.
   */
  codAmount?: number | null;
  /**
   * True when a doorstep photo was uploaded for this stop. `type` alone cannot
   * say so — it names one proof, and the app captures two.
   */
  photoCaptured?: boolean;
  /** The stored proof photo, as returned by `/proof/`. */
  proofUrl?: string | null;
  exceptionReason?: DeliveryException | null;
}

export class DeliveryAssignmentService {
  static async getAssignments(): Promise<ApiResult<Assignment[]>> {
    const response = await apiClient.get<Assignment[]>("/api/delivery-partner/assignments/");
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data || [] };
  }

  static async acceptAssignment(id: string): Promise<ApiResult<Assignment>> {
    const response = await apiClient.post<Assignment>(`/api/delivery-partner/assignments/${id}/accept/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true, data: response.data };
  }

  static async markPickedUp(id: string, handoverCode: string): Promise<ApiResult> {
    const response = await apiClient.post(`/api/delivery-partner/assignments/${id}/pickup/`, {
      handover_code: handoverCode,
    });
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }

  static async markInTransit(id: string, latitude?: number, longitude?: number): Promise<ApiResult> {
    const response = await apiClient.post(`/api/delivery-partner/assignments/${id}/transit/`, {
      latitude,
      longitude,
    });
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }

  /**
   * Close a stop.
   *
   * Several fields here are ahead of the documented `deliver/` contract —
   * `cod_amount`, `photo_captured`, `proof_url`, `exception_reason`,
   * `accuracy_m`. They are sent anyway, so the client half of each fix is in
   * place and one backend change switches it on; until then the server ignores
   * them. `cod_collected` has been in this position for a while and is still
   * dropped server-side. See docs/DELIVERY_API.md § "Required server changes".
   *
   * Keys whose value is undefined are dropped from the body rather than sent as
   * null, so a backend that validates strictly sees only what the app knows.
   */
  static async markDelivered(id: string, proof: DeliveryProof): Promise<ApiResult> {
    const body: Record<string, unknown> = {
      stop_id: proof.stopId,
      type: proof.type,
      otp_code: proof.otpCode,
      latitude: proof.latitude,
      longitude: proof.longitude,
      // Explicitly false, never absent: "no cash taken" is an assertion the
      // rider made, and it has to be distinguishable from a client that never
      // asked the question.
      cod_collected: proof.codCollected ?? false,
    };

    if (proof.accuracyM != null) body.accuracy_m = proof.accuracyM;
    if (proof.codAmount != null) body.cod_amount = proof.codAmount;
    if (proof.photoCaptured != null) body.photo_captured = proof.photoCaptured;
    if (proof.proofUrl) body.proof_url = proof.proofUrl;
    if (proof.exceptionReason) body.exception_reason = proof.exceptionReason;

    const response = await apiClient.post(`/api/delivery-partner/assignments/${id}/deliver/`, body);
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }

  static async resendOtp(id: string): Promise<ApiResult> {
    const response = await apiClient.post(`/api/delivery-partner/assignments/${id}/resend-otp/`);
    if (response.error) return { success: false, error: response.error };
    return { success: true };
  }
}
