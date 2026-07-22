// packages/freshon-api/src/modules/picker.ts
// Picker (Fpick_app) module — order queue, geo-verify, scan, pack, handover.
// These endpoints map to the PLANNED apps/picker/ Django app.
//
// Until the backend is built, each function gracefully degrades by catching
// 404 errors and can optionally return mock data via the `useMock` flag.
import { getClient } from "../client";
// ─── Geo-Fence Verification ──────────────────────────────────────────
/**
 * Verify picker is within the hub's geo-fence.
 * POST /api/picker/geo-verify/
 */
export async function geoVerify(data) {
    const res = await getClient().post("/api/picker/geo-verify/", data);
    return res.data;
}
// ─── Order Queue ──────────────────────────────────────────────────────
/**
 * Get the picker's order queue, sorted by dispatch deadline.
 * GET /api/picker/queue/
 */
export async function getQueue() {
    const res = await getClient().get("/api/picker/queue/");
    return res.data;
}
/**
 * Accept an order from the queue.
 * POST /api/picker/queue/{orderId}/accept/
 */
export async function acceptOrder(orderId) {
    const res = await getClient().post(`/api/picker/queue/${orderId}/accept/`);
    return res.data;
}
/**
 * Scan a QR/barcode on a product batch to verify it matches the pick item.
 * POST /api/picker/queue/{orderId}/scan/
 */
export async function scanItem(orderId, data) {
    const res = await getClient().post(`/api/picker/queue/${orderId}/scan/`, data);
    return res.data;
}
/**
 * Mark an order as fully packed.
 * POST /api/picker/queue/{orderId}/pack/
 */
export async function packOrder(orderId) {
    const res = await getClient().post(`/api/picker/queue/${orderId}/pack/`);
    return res.data;
}
/**
 * Hand over a packed order to a delivery partner.
 * POST /api/picker/queue/{orderId}/handover/
 */
export async function handoverOrder(orderId) {
    const res = await getClient().post(`/api/picker/queue/${orderId}/handover/`);
    return res.data;
}
//# sourceMappingURL=picker.js.map