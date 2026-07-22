// packages/freshon-api/src/modules/orders.ts
// Order management module — place order, track order, list orders.
// Maps to Django's apps/orders/ endpoints.
import { getClient } from "../client";
/**
 * Place a new order.
 * POST /api/orders/orders/
 *
 * NOTE: Prices are calculated server-side — do NOT send amounts from the frontend.
 * The backend reads batch prices at order time for security.
 */
export async function placeOrder(data) {
    const res = await getClient().post("/api/orders/orders/", data);
    return res.data;
}
/**
 * Get an order by its tracking ID (e.g. "FRSH-A1B2C3").
 * GET /api/orders/orders/{tracking_id}/
 */
export async function getOrder(trackingId) {
    const res = await getClient().get(`/api/orders/orders/${trackingId}/`);
    return res.data;
}
/**
 * List all orders for the current user.
 * GET /api/orders/orders/
 */
export async function listOrders() {
    const res = await getClient().get("/api/orders/orders/");
    return res.data;
}
/**
 * Add an item to an existing order (before it's packed).
 * POST /api/orders/orders/{tracking_id}/add-item/
 */
export async function addItemToOrder(trackingId, data) {
    const res = await getClient().post(`/api/orders/orders/${trackingId}/add-item/`, data);
    return res.data;
}
/**
 * Remove an item from an existing order (before it's packed).
 * POST /api/orders/orders/{tracking_id}/remove-item/
 */
export async function removeItemFromOrder(trackingId, data) {
    const res = await getClient().post(`/api/orders/orders/${trackingId}/remove-item/`, data);
    return res.data;
}
/**
 * Update the quantity of an item in an existing order.
 * POST /api/orders/orders/{tracking_id}/update-item/
 */
export async function updateItemQuantity(trackingId, data) {
    const res = await getClient().post(`/api/orders/orders/${trackingId}/update-item/`, data);
    return res.data;
}
/**
 * Cancel an order (if not yet packed).
 * POST /api/orders/orders/{tracking_id}/cancel/
 */
export async function cancelOrder(trackingId, reason) {
    const res = await getClient().post(`/api/orders/orders/${trackingId}/cancel/`, { reason });
    return res.data;
}
export async function getLiveTracking(trackingId) {
    const res = await getClient().get(`/api/orders/orders/${trackingId}/live-tracking/`);
    return res.data;
}
/**
 * Confirm additional payment for order modification.
 * POST /api/orders/orders/{tracking_id}/confirm-modification-payment/
 */
export async function confirmModificationPayment(trackingId, data) {
    const res = await getClient().post(`/api/orders/orders/${trackingId}/confirm-modification-payment/`, data);
    return res.data;
}
//# sourceMappingURL=orders.js.map