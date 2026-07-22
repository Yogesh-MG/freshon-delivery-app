import type { DeliverySlot, DeliveryAddress, SaveAddressRequest, LocationValidationRequest, LocationValidationResponse, CheckoutConfig } from "../types";
/**
 * List available delivery slots (EXPRESS, SAME_DAY, NEXT_DAY, OUT_OF_RADIUS).
 * GET /api/delivery/slots/
 * Pass the customer's coordinates so the backend can return the correct slot
 * set (out-of-radius addresses get the 3-4 day standard slot instead of express).
 */
export declare function listSlots(coords?: {
    latitude: number;
    longitude: number;
}): Promise<DeliverySlot[]>;
/**
 * List the user's saved delivery addresses.
 * GET /api/delivery/addresses/
 */
export declare function listAddresses(): Promise<DeliveryAddress[]>;
/**
 * Save a new delivery address.
 * POST /api/delivery/addresses/
 */
export declare function saveAddress(data: SaveAddressRequest): Promise<DeliveryAddress>;
/**
 * Update an existing delivery address.
 * PATCH /api/delivery/addresses/{id}/
 */
export declare function updateAddress(id: number, data: Partial<SaveAddressRequest>): Promise<DeliveryAddress>;
/**
 * Delete a delivery address.
 * DELETE /api/delivery/addresses/{id}/
 */
export declare function deleteAddress(id: number): Promise<void>;
/**
 * Validate if a location is within a Freshon service area.
 * POST /api/delivery/validate-location/
 *
 * Gracefully degrades: returns { valid: true } if the endpoint isn't deployed yet.
 */
export declare function validateLocation(data: LocationValidationRequest): Promise<LocationValidationResponse>;
/**
 * Get checkout configuration settings (COD availability, free delivery threshold).
 * GET /api/delivery/checkout-config/
 */
export declare function getCheckoutConfig(): Promise<CheckoutConfig>;
/**
 * Admin: get the full checkout/pricing config (staff only).
 * GET /api/delivery/checkout-config/admin/
 */
export declare function getCheckoutConfigAdmin(): Promise<CheckoutConfig>;
/**
 * Admin: update checkout/pricing config — customer fee levers + rider payout rates.
 * PATCH /api/delivery/checkout-config/admin/
 */
export declare function updateCheckoutConfig(data: Partial<CheckoutConfig>): Promise<CheckoutConfig>;
//# sourceMappingURL=delivery.d.ts.map