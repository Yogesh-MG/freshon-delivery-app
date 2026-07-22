// packages/freshon-api/src/modules/delivery.ts
// Delivery management module — slots, addresses, location validation.
// Maps to Django's apps/delivery/ endpoints.
import { getClient } from "../client";
// ─── Slots ────────────────────────────────────────────────────────────
/**
 * List available delivery slots (EXPRESS, SAME_DAY, NEXT_DAY, OUT_OF_RADIUS).
 * GET /api/delivery/slots/
 * Pass the customer's coordinates so the backend can return the correct slot
 * set (out-of-radius addresses get the 3-4 day standard slot instead of express).
 */
export async function listSlots(coords) {
    const params = coords
        ? { params: { latitude: coords.latitude, longitude: coords.longitude } }
        : {};
    const res = await getClient().get("/api/delivery/slots/", params);
    return res.data;
}
// ─── Addresses ────────────────────────────────────────────────────────
/**
 * List the user's saved delivery addresses.
 * GET /api/delivery/addresses/
 */
export async function listAddresses() {
    const res = await getClient().get("/api/delivery/addresses/");
    return res.data;
}
/**
 * Save a new delivery address.
 * POST /api/delivery/addresses/
 */
export async function saveAddress(data) {
    const res = await getClient().post("/api/delivery/addresses/", data);
    return res.data;
}
/**
 * Update an existing delivery address.
 * PATCH /api/delivery/addresses/{id}/
 */
export async function updateAddress(id, data) {
    const res = await getClient().patch(`/api/delivery/addresses/${id}/`, data);
    return res.data;
}
/**
 * Delete a delivery address.
 * DELETE /api/delivery/addresses/{id}/
 */
export async function deleteAddress(id) {
    await getClient().delete(`/api/delivery/addresses/${id}/`);
}
// ─── Location Validation ──────────────────────────────────────────────
/**
 * Validate if a location is within a Freshon service area.
 * POST /api/delivery/validate-location/
 *
 * Gracefully degrades: returns { valid: true } if the endpoint isn't deployed yet.
 */
export async function validateLocation(data) {
    try {
        const res = await getClient().post("/api/delivery/validate-location/", data);
        return {
            valid: res.data.valid ?? true,
            message: res.data.message ?? "Location accepted",
            service_area: res.data.service_area,
            distance_km: res.data.distance_km,
        };
    }
    catch (error) {
        const axiosErr = error;
        // 404 = endpoint not yet implemented — allow the location
        if (axiosErr.response?.status === 404) {
            return {
                valid: true,
                message: "Location accepted (validation pending)",
            };
        }
        return {
            valid: false,
            message: axiosErr.response?.data?.message ??
                "Unable to validate location, please try again",
        };
    }
}
// ─── Checkout Configuration ───────────────────────────────────────────
/**
 * Get checkout configuration settings (COD availability, free delivery threshold).
 * GET /api/delivery/checkout-config/
 */
export async function getCheckoutConfig() {
    const res = await getClient().get("/api/delivery/checkout-config/");
    return res.data;
}
/**
 * Admin: get the full checkout/pricing config (staff only).
 * GET /api/delivery/checkout-config/admin/
 */
export async function getCheckoutConfigAdmin() {
    const res = await getClient().get("/api/delivery/checkout-config/admin/");
    return res.data;
}
/**
 * Admin: update checkout/pricing config — customer fee levers + rider payout rates.
 * PATCH /api/delivery/checkout-config/admin/
 */
export async function updateCheckoutConfig(data) {
    const res = await getClient().patch("/api/delivery/checkout-config/admin/", data);
    return res.data;
}
//# sourceMappingURL=delivery.js.map