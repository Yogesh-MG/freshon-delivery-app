// packages/freshon-api/src/modules/b2b.ts
// B2B white-label channel — bulk/branded packaging, cost-plus pricing, prepaid orders.
// Maps to Django's apps/b2b/ endpoints (mounted at /api/b2b/).
//
// Mirrors the consumer delivery.listSlots + delivery.getCheckoutConfig shape so the
// forked B2B checkout screen needs minimal changes.
import { getClient } from "../client";
// ─── Onboarding ─────────────────────────────────────────────────────────
/** Create/update the caller's B2B account. POST /api/b2b/register/ */
export async function b2bRegister(data) {
    const res = await getClient().post("/api/b2b/register/", data);
    return res.data;
}
/** Get the caller's B2B account. GET /api/b2b/me/ */
export async function getMe() {
    const res = await getClient().get("/api/b2b/me/");
    return res.data;
}
/** Update the caller's B2B account. PATCH /api/b2b/me/ */
export async function updateMe(data) {
    const res = await getClient().patch("/api/b2b/me/", data);
    return res.data;
}
// ─── Catalog ────────────────────────────────────────────────────────────
/** Active B2B-priced products (grouped, with per-variant prices). GET /api/b2b/catalog/ */
export async function getB2BCatalog() {
    const res = await getClient().get("/api/b2b/catalog/");
    return res.data;
}
// ─── Quotes (RFQ) ─────────────────────────────────────────────────────────
/** List the caller's quotes. GET /api/b2b/quote/request/ */
export async function listQuotes() {
    const res = await getClient().get("/api/b2b/quote/request/");
    return res.data;
}
/** Request a quote. POST /api/b2b/quote/request/ */
export async function requestQuote(items) {
    const res = await getClient().post("/api/b2b/quote/request/", { items });
    return res.data;
}
/** Get one quote. GET /api/b2b/quote/{id}/ */
export async function getQuote(id) {
    const res = await getClient().get(`/api/b2b/quote/${id}/`);
    return res.data;
}
// ─── Brands & packaging ────────────────────────────────────────────────
/** List the caller's brands. GET /api/b2b/brands/ */
export async function listBrands() {
    const res = await getClient().get("/api/b2b/brands/");
    return res.data;
}
/** Create a brand. POST /api/b2b/brands/ */
export async function createBrand(data) {
    const res = await getClient().post("/api/b2b/brands/", data);
    return res.data;
}
/** Update a brand (resets it to DRAFT for re-approval). PATCH /api/b2b/brands/{id}/ */
export async function updateBrand(id, data) {
    const res = await getClient().patch(`/api/b2b/brands/${id}/`, data);
    return res.data;
}
/** Upload a brand logo (reference only — never printed). POST /api/b2b/brands/{id}/ (multipart) */
export async function uploadBrandLogo(id, file) {
    const form = new FormData();
    form.append("logo_image", file);
    const res = await getClient().patch(`/api/b2b/brands/${id}/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
}
/** Buyer-supplied packaging stock balances. GET /api/b2b/packaging/stock/ */
export async function getPackagingStock() {
    const res = await getClient().get("/api/b2b/packaging/stock/");
    return res.data;
}
// ─── Orders ─────────────────────────────────────────────────────────────
/** List the caller's orders. GET /api/b2b/orders/ */
export async function listB2BOrders() {
    const res = await getClient().get("/api/b2b/orders/");
    return res.data;
}
/** Place an order (prices resolved server-side). POST /api/b2b/orders/ */
export async function placeB2BOrder(data) {
    const res = await getClient().post("/api/b2b/orders/", data);
    return res.data;
}
/** Get one order. GET /api/b2b/orders/{id}/ */
export async function getB2BOrder(id) {
    const res = await getClient().get(`/api/b2b/orders/${id}/`);
    return res.data;
}
/** Re-order from a previous order (re-prices at current active prices). POST /api/b2b/orders/{id}/reorder/ */
export async function reorder(id) {
    const res = await getClient().post(`/api/b2b/orders/${id}/reorder/`, {});
    return res.data;
}
// ─── Config (read-only for buyers) ────────────────────────────────────
/** Active B2B delivery slots. GET /api/b2b/delivery-slots/ */
export async function listB2BSlots() {
    const res = await getClient().get("/api/b2b/delivery-slots/");
    return res.data;
}
/** B2B checkout config (prepaid/COD/payment methods). GET /api/b2b/checkout-config/ */
export async function getB2BCheckoutConfig() {
    const res = await getClient().get("/api/b2b/checkout-config/");
    return res.data;
}
// ─── FOS / founder ────────────────────────────────────────────────────
/** Cost-plus price suggestion + breakdown. POST /api/b2b/pricing/suggest/ */
export async function suggestPrice(data) {
    const res = await getClient().post("/api/b2b/pricing/suggest/", data);
    return res.data;
}
/** List approved/versioned prices. GET /api/b2b/pricing/ */
export async function listPrices(params) {
    const res = await getClient().get("/api/b2b/pricing/", { params });
    return res.data;
}
/** Approve a price → creates an ACTIVE B2BPrice (supersedes prior). POST /api/b2b/pricing/ */
export async function approvePrice(data) {
    const res = await getClient().post("/api/b2b/pricing/", data);
    return res.data;
}
/** Get overhead config. GET /api/b2b/overhead/ */
export async function getOverheadConfig() {
    const res = await getClient().get("/api/b2b/overhead/");
    return res.data;
}
/** Update overhead config. PUT /api/b2b/overhead/ */
export async function updateOverheadConfig(data) {
    const res = await getClient().put("/api/b2b/overhead/", data);
    return res.data;
}
// ─── FOS / founder — admin (customers, brands, orders, settings) ───────
/** List B2B customers (founder). GET /api/b2b/admin/customers/ */
export async function adminListCustomers(status) {
    const res = await getClient().get("/api/b2b/admin/customers/", {
        params: status ? { status } : undefined,
    });
    return res.data;
}
/** Approve KYC / set tier / set MOV (founder). PATCH /api/b2b/admin/customers/{id}/ */
export async function adminUpdateCustomer(id, data) {
    const res = await getClient().patch(`/api/b2b/admin/customers/${id}/`, data);
    return res.data;
}
/** List brands for review (founder). GET /api/b2b/admin/brands/ */
export async function adminListBrands(status) {
    const res = await getClient().get("/api/b2b/admin/brands/", {
        params: status ? { status } : undefined,
    });
    return res.data;
}
/** Approve/reject a brand (founder). PATCH /api/b2b/admin/brands/{id}/ */
export async function adminReviewBrand(id, data) {
    const res = await getClient().patch(`/api/b2b/admin/brands/${id}/`, data);
    return res.data;
}
/** List B2B orders (founder). GET /api/b2b/admin/orders/ */
export async function adminListOrders(status) {
    const res = await getClient().get("/api/b2b/admin/orders/", {
        params: status ? { status } : undefined,
    });
    return res.data;
}
/** Mark paid or set status (founder). PATCH /api/b2b/admin/orders/{id}/ */
export async function adminUpdateOrder(id, data) {
    const res = await getClient().patch(`/api/b2b/admin/orders/${id}/`, data);
    return res.data;
}
// Packaging receiving (founder)
/** List packaging receipts. GET /api/b2b/packaging/receipts/ */
export async function listPackagingReceipts() {
    const res = await getClient().get("/api/b2b/packaging/receipts/");
    return res.data;
}
/** Create (optionally finalize) a packaging receipt. POST /api/b2b/packaging/receipts/ */
export async function createPackagingReceipt(data) {
    const res = await getClient().post("/api/b2b/packaging/receipts/", data);
    return res.data;
}
/** Finalize a packaging receipt → credits buyer stock. POST /api/b2b/packaging/receipts/{id}/finalize/ */
export async function finalizePackagingReceipt(id) {
    const res = await getClient().post(`/api/b2b/packaging/receipts/${id}/finalize/`, {});
    return res.data;
}
// Settings (founder)
/** List all B2B delivery slots (founder). GET /api/b2b/admin/delivery-slots/ */
export async function adminListSlots() {
    const res = await getClient().get("/api/b2b/admin/delivery-slots/");
    return res.data;
}
/** Create a B2B delivery slot (founder). POST /api/b2b/admin/delivery-slots/ */
export async function adminCreateSlot(data) {
    const res = await getClient().post("/api/b2b/admin/delivery-slots/", data);
    return res.data;
}
/** Update a B2B delivery slot (founder). PATCH /api/b2b/admin/delivery-slots/{id}/ */
export async function adminUpdateSlot(id, data) {
    const res = await getClient().patch(`/api/b2b/admin/delivery-slots/${id}/`, data);
    return res.data;
}
/** Update B2B checkout config (founder). PUT /api/b2b/admin/checkout-config/ */
export async function adminUpdateCheckoutConfig(data) {
    const res = await getClient().put("/api/b2b/admin/checkout-config/", data);
    return res.data;
}
//# sourceMappingURL=b2b.js.map