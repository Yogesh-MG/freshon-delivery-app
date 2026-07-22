import type { DeliveryMission, DeliveryPartnerStats, DeliveryPartnerStatusRequest, ProofOfDeliveryRequest } from "../types";
/**
 * Update the partner's online/offline status + current GPS.
 * PATCH /api/delivery-partner/status/
 */
export declare function updateStatus(data: DeliveryPartnerStatusRequest): Promise<{
    message: string;
    online: boolean;
}>;
/**
 * Get active delivery assignments.
 * GET /api/delivery-partner/assignments/
 */
export declare function getAssignments(): Promise<DeliveryMission[]>;
/**
 * Accept a delivery assignment.
 * POST /api/delivery-partner/assignments/{id}/accept/
 */
export declare function acceptAssignment(missionId: string): Promise<DeliveryMission>;
/**
 * Mark that the partner has picked up the order from the hub.
 * POST /api/delivery-partner/assignments/{id}/pickup/
 */
export declare function markPickup(missionId: string): Promise<{
    message: string;
}>;
/**
 * Mark that the partner is in transit (with GPS coords).
 * POST /api/delivery-partner/assignments/{id}/transit/
 */
export declare function markInTransit(missionId: string, coords: {
    latitude: number;
    longitude: number;
}): Promise<{
    message: string;
}>;
/**
 * Mark a stop as delivered with proof.
 * POST /api/delivery-partner/assignments/{id}/deliver/
 */
export declare function markDelivered(missionId: string, stopId: string, proof: ProofOfDeliveryRequest): Promise<{
    message: string;
}>;
/**
 * Upload proof-of-delivery media (photo).
 * POST /api/delivery-partner/proof/
 */
export declare function uploadProof(data: FormData): Promise<{
    url: string;
}>;
/**
 * Get today's earnings summary.
 * GET /api/delivery-partner/earnings/
 */
export declare function getEarnings(): Promise<DeliveryPartnerStats>;
//# sourceMappingURL=delivery-partner.d.ts.map