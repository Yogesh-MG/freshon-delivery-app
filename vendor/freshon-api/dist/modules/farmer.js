// packages/freshon-api/src/modules/farmer.ts
// Farmer (Farm_app) module — registration, profile, media, batches, dashboard.
// These endpoints map to the PLANNED apps/farmer/ Django app.
import { getClient } from "../client";
// ─── Registration & Auth ──────────────────────────────────────────────
/**
 * Register or authenticate a farmer via phone + OTP.
 * POST /api/farmer/register/
 *
 * Step 1: Send { phone } to receive an OTP.
 * Step 2: Send { phone, otp } to verify and get tokens.
 */
export async function registerFarmer(data) {
    const res = await getClient().post("/api/farmer/register/", data);
    return res.data;
}
/**
 * Let an already-authenticated user (e.g. a consumer) add the FARMER role and
 * create a farmer profile on their existing account — no second OTP.
 * POST /api/farmer/become/
 */
export async function becomeFarmer(name) {
    const res = await getClient().post("/api/farmer/become/", name ? { name } : {});
    return res.data;
}
// ─── Profile ──────────────────────────────────────────────────────────
/**
 * Get the farmer's profile.
 * GET /api/farmer/profile/
 */
export async function getProfile() {
    const res = await getClient().get("/api/farmer/profile/");
    return res.data;
}
/**
 * Update the farmer's profile.
 * PATCH /api/farmer/profile/
 */
export async function updateProfile(data) {
    const res = await getClient().patch("/api/farmer/profile/", data);
    return res.data;
}
// ─── Media Upload ─────────────────────────────────────────────────────
/**
 * Upload farm/product video or profile photo.
 * POST /api/farmer/media/
 *
 * Uses FormData for file upload.
 */
export async function uploadMedia(type, file) {
    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);
    const res = await getClient().post("/api/farmer/media/", formData);
    return res.data;
}
// ─── Dashboard ────────────────────────────────────────────────────────
/**
 * Get the farmer's aggregated dashboard metrics.
 * GET /api/farmer/dashboard/
 */
export async function getDashboard() {
    const res = await getClient().get("/api/farmer/dashboard/");
    return res.data;
}
// ─── Batches ──────────────────────────────────────────────────────────
/**
 * List the farmer's own inventory batches.
 * GET /api/farmer/batches/
 */
export async function listBatches() {
    const res = await getClient().get("/api/farmer/batches/");
    return res.data;
}
/**
 * Add a new harvest batch.
 * POST /api/farmer/batches/
 */
export async function addBatch(data) {
    const res = await getClient().post("/api/farmer/batches/", data);
    return res.data;
}
/**
 * Update an existing batch (e.g. update stock after harvest).
 * PATCH /api/farmer/batches/{id}/
 */
export async function updateBatch(id, data) {
    const res = await getClient().patch(`/api/farmer/batches/${id}/`, data);
    return res.data;
}
// ─── Payouts ──────────────────────────────────────────────────────────
/**
 * Get the farmer's payout history.
 * GET /api/farmer/payouts/
 */
export async function getPayouts() {
    const res = await getClient().get("/api/farmer/payouts/");
    return res.data;
}
// ─── Bank Details ─────────────────────────────────────────────────────
/**
 * Get the farmer's bank account details.
 * GET /api/farmer/bank/
 */
export async function getBankDetails() {
    const res = await getClient().get("/api/farmer/bank/");
    return res.data;
}
/**
 * Update the farmer's bank account details.
 * POST /api/farmer/bank/
 */
export async function updateBankDetails(data) {
    const res = await getClient().post("/api/farmer/bank/", data);
    return res.data;
}
// ─── Verification (FOS-approved onboarding) ───────────────────────────
/**
 * Submit the (completed) farmer profile for FOS verification.
 * POST /api/farmer/submit-for-review/
 * Returns 400 with `missing_sections` if required fields aren't filled.
 */
export async function submitForReview() {
    const res = await getClient().post("/api/farmer/submit-for-review/", {});
    return res.data;
}
// ─── Purchase orders (farmer view) ────────────────────────────────────
/**
 * List the farmer's own purchase orders. GET /api/farmer/purchase-orders/
 * @param status optional PENDING | APPROVED | REJECTED | RECEIVED filter
 */
export async function listPurchaseOrders(status) {
    const res = await getClient().get("/api/farmer/purchase-orders/", {
        params: status ? { status } : undefined,
    });
    return res.data;
}
/** FOS admin: list farmers awaiting verification. GET /api/farmer/fos/approvals/ */
export async function listFarmerApprovals() {
    const res = await getClient().get("/api/farmer/fos/approvals/");
    return res.data;
}
/**
 * FOS admin: approve or reject a farmer's verification.
 * POST /api/farmer/fos/approvals/{farmerId}/decide/
 */
export async function decideFarmerApproval(farmerId, action, reason) {
    const res = await getClient().post(`/api/farmer/fos/approvals/${farmerId}/decide/`, { action, reason });
    return res.data;
}
/** FOS admin: price-partner batches whose fixed price awaits an allow/cancel decision. */
export async function listFarmerPriceReviews() {
    const res = await getClient().get("/api/farmer/fos/farmer-prices/");
    return res.data;
}
/**
 * FOS admin: allow or cancel a price-partner's farmer-fixed price.
 * POST /api/farmer/fos/farmer-prices/{batchId}/decide/
 * `cancel` reverts to FreshOn pricing (optionally with an override price).
 */
export async function decideFarmerPrice(batchId, action, overridePrice) {
    const res = await getClient().post(`/api/farmer/fos/farmer-prices/${batchId}/decide/`, { action, override_price: overridePrice });
    return res.data;
}
/**
 * FOS admin: list farmer bank-account changes awaiting approval.
 * GET /api/farmer/fos/bank-changes/
 */
export async function listFarmerBankChanges() {
    const res = await getClient().get("/api/farmer/fos/bank-changes/");
    return res.data;
}
/**
 * FOS admin: approve or reject a farmer's pending bank-account change.
 * POST /api/farmer/fos/bank-changes/{farmerId}/decide/
 */
export async function decideFarmerBankChange(farmerId, action, reason) {
    const res = await getClient().post(`/api/farmer/fos/bank-changes/${farmerId}/decide/`, { action, reason });
    return res.data;
}
// ─── Notifications ───────────────────────────────────────────────────
/**
 * Get the farmer's notifications.
 * GET /api/farmer/notifications/
 */
export async function getNotifications() {
    const res = await getClient().get("/api/farmer/notifications/");
    return res.data;
}
/**
 * Mark a notification as read (or all if no ID provided).
 * POST /api/farmer/notifications/
 */
export async function markNotificationRead(id) {
    const res = await getClient().post("/api/farmer/notifications/", { id });
    return res.data;
}
// ─── Orders ───────────────────────────────────────────────────────────
/**
 * Get orders containing this farmer's products.
 * GET /api/farmer/orders/
 */
export async function getOrders() {
    const res = await getClient().get("/api/farmer/orders/");
    return res.data;
}
/**
 * Update order status (mark packed, request pickup).
 * POST /api/farmer/orders/{id}/status/
 */
export async function updateOrderStatus(orderId, status) {
    const res = await getClient().post(`/api/farmer/orders/${orderId}/status/`, { status });
    return res.data;
}
//# sourceMappingURL=farmer.js.map