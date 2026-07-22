import type { Order, PlaceOrderRequest, PlaceOrderResponse, PaginatedResponse } from "../types";
/**
 * Place a new order.
 * POST /api/orders/orders/
 *
 * NOTE: Prices are calculated server-side — do NOT send amounts from the frontend.
 * The backend reads batch prices at order time for security.
 */
export declare function placeOrder(data: PlaceOrderRequest): Promise<PlaceOrderResponse>;
/**
 * Get an order by its tracking ID (e.g. "FRSH-A1B2C3").
 * GET /api/orders/orders/{tracking_id}/
 */
export declare function getOrder(trackingId: string): Promise<Order>;
/**
 * List all orders for the current user.
 * GET /api/orders/orders/
 */
export declare function listOrders(): Promise<PaginatedResponse<Order>>;
/**
 * Add an item to an existing order (before it's packed).
 * POST /api/orders/orders/{tracking_id}/add-item/
 */
export declare function addItemToOrder(trackingId: string, data: {
    batch_id: number;
    quantity: number;
}): Promise<any>;
/**
 * Remove an item from an existing order (before it's packed).
 * POST /api/orders/orders/{tracking_id}/remove-item/
 */
export declare function removeItemFromOrder(trackingId: string, data: {
    order_item_id: number;
}): Promise<any>;
/**
 * Update the quantity of an item in an existing order.
 * POST /api/orders/orders/{tracking_id}/update-item/
 */
export declare function updateItemQuantity(trackingId: string, data: {
    order_item_id: number;
    quantity: number;
}): Promise<any>;
/**
 * Cancel an order (if not yet packed).
 * POST /api/orders/orders/{tracking_id}/cancel/
 */
export declare function cancelOrder(trackingId: string, reason?: string): Promise<any>;
/**
 * Live delivery tracking for an order — real telemetry off order.delivery_assignment.
 * GET /api/orders/orders/{tracking_id}/live-tracking/
 *
 * `live_location.enabled` is the offline-rider gate: only true while the
 * assignment is IN_TRANSIT and the rider's last GPS fix is fresh (≤ 2 min).
 * When stale/offline, fall back to the last-known driver dot.
 *
 * store / destination / driver are null until the corresponding real coordinate
 * exists (no dummy fallbacks).
 */
export interface TrackingPoint {
    lat: number | null;
    lng: number | null;
}
export interface LiveTracking {
    headline: string;
    is_transporting: boolean;
    live_location: {
        enabled: boolean;
        store: (TrackingPoint & {
            name: string | null;
        }) | null;
        destination: TrackingPoint | null;
        driver: (TrackingPoint & {
            name: string | null;
            phone: string | null;
        }) | null;
        updated_at: string | null;
    };
}
export declare function getLiveTracking(trackingId: string): Promise<LiveTracking>;
/**
 * Confirm additional payment for order modification.
 * POST /api/orders/orders/{tracking_id}/confirm-modification-payment/
 */
export declare function confirmModificationPayment(trackingId: string, data: {
    wallet_amount?: number;
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
}): Promise<any>;
//# sourceMappingURL=orders.d.ts.map