// packages/freshon-api/src/modules/pos.ts
// POS (Fpos) module — PIN login, shift management, orders, wastage.
// These endpoints map to the PLANNED apps/pos/ Django app.
import { getClient } from "../client";
import { setAuthTokens } from "../client";
// ─── Auth ─────────────────────────────────────────────────────────────
/**
 * POS terminal login via employee ID + PIN.
 * POST /api/pos/login/
 */
export async function posLogin(data) {
    const res = await getClient().post("/api/pos/login/", data);
    if (res.data.access && res.data.refresh) {
        setAuthTokens(res.data.access, res.data.refresh);
    }
    return res.data;
}
/**
 * Change the logged-in operator's own login PIN.
 * Requires the current PIN. POST /api/pos/change-pin/
 */
export async function changePin(currentPin, newPin) {
    const res = await getClient().post("/api/pos/change-pin/", {
        current_pin: currentPin,
        new_pin: newPin,
    });
    return res.data;
}
/**
 * Verify the AUTHENTICATED operator's PIN server-side (PIN is stored hashed) to
 * unlock the idle screen lock. Works even after a handover token-swap, where no
 * PIN was typed on this terminal. `no_pin` = the operator has no PIN set, so the
 * caller should allow the unlock. POST /api/pos/verify-pin/
 */
export async function verifyPin(pin) {
    const res = await getClient().post("/api/pos/verify-pin/", { pin });
    return res.data;
}
/**
 * POS: request a discount on the current bill → enters the FOS approval queue.
 * The POS no longer proposes a percentage; it sends the bill (+ optional reason)
 * and the OS originates the discount.
 */
export async function requestDiscountApproval(data) {
    const res = await getClient().post("/api/pos/discount/request/", data);
    return res.data;
}
/** POS: poll a discount request for its decision. */
export async function getDiscountStatus(id) {
    const res = await getClient().get("/api/pos/discount/status/", {
        params: { id },
    });
    return res.data;
}
/** FOS: pending approval queue (with customer history snapshot). */
export async function getDiscountQueue(params) {
    const res = await getClient().get("/api/pos/discount/queue/", { params });
    return res.data;
}
/**
 * FOS: act on a request — approve | reject | modify | defer.
 * On approve/modify the OS originates the discount via `pct` (preferred) or an
 * absolute `amount`.
 */
export async function decideDiscount(id, action, opts) {
    const res = await getClient().post(`/api/pos/discount/${id}/decide/`, {
        action,
        ...opts,
    });
    return res.data;
}
/** POS: cancel a still-pending discount request. */
export async function cancelDiscount(id, reason) {
    const res = await getClient().post(`/api/pos/discount/${id}/cancel/`, { reason });
    return res.data;
}
/** POS: confirm an approved discount was applied to a sale (completes the audit trail). */
export async function confirmDiscountApplied(id, opts) {
    const res = await getClient().post(`/api/pos/discount/${id}/applied/`, opts ?? {});
    return res.data;
}
/** Founder dashboard: hub budgets + per-approver stats this month. */
export async function getDiscountBudget() {
    const res = await getClient().get("/api/pos/discount/budget/");
    return res.data;
}
/** POS: create a cash drop acknowledgment request (cashier → authority). */
export async function requestCashDrop(data) {
    const res = await getClient().post("/api/pos/cash/drop/request/", data);
    return res.data;
}
/** POS: poll a cash drop request for its acknowledgment status. */
export async function getCashDropStatus(id) {
    const res = await getClient().get("/api/pos/cash/drop/status/", { params: { id } });
    return res.data;
}
/** POS: acknowledged cash-drop total for the current open shift (rehydrates the
 *  close screen so prior drops survive closing/reopening it). */
export async function shiftCashDropTotal() {
    const res = await getClient().get("/api/pos/cash/drop/shift-total/");
    return res.data;
}
/** FOS: list pending cash drop requests. */
export async function getCashDropQueue() {
    const res = await getClient().get("/api/pos/cash/drop/queue/");
    return res.data;
}
/** FOS: authority acknowledges or rejects a cash drop request. */
export async function acknowledgeCashDrop(id, action, note) {
    const res = await getClient().post(`/api/pos/cash/drop/${id}/acknowledge/`, { action, note });
    return res.data;
}
/** POS: cashier submits the day-end drawer count for remote authority approval. */
export async function requestShiftCloseApproval(data) {
    const res = await getClient().post("/api/pos/shift/close-approval/request/", data);
    return res.data;
}
/** POS: poll a shift-close request for the authority's decision. */
export async function getShiftCloseApprovalStatus(id) {
    const res = await getClient().get("/api/pos/shift/close-approval/status/", { params: { id } });
    return res.data;
}
/** FOS: list pending shift-close approvals. */
export async function getShiftCloseApprovalQueue() {
    const res = await getClient().get("/api/pos/shift/close-approval/queue/");
    return res.data;
}
/**
 * FOS: authority approves (closing the shift) or rejects a close request.
 * When the drawer is SHORT and the authority approves anyway, the backend
 * requires `shortage_reason` + `shortage_resolution` (recover from the
 * employee's salary, company absorbs the loss, or hold/investigate).
 */
export async function decideShiftCloseApproval(id, action, note, shortage) {
    const res = await getClient().post(`/api/pos/shift/close-approval/${id}/decide/`, {
        action,
        note,
        shortage_reason: shortage?.reason,
        shortage_resolution: shortage?.resolution,
    });
    return res.data;
}
/**
 * FOS: list shift-end cash handovers (day-end drawer reviews).
 * Pass status="open" for only the ones needing attention
 * (pending handover, short review, escalated).
 * GET /api/pos/cash/handovers/
 */
export async function listCashHandovers(status) {
    const res = await getClient().get("/api/pos/cash/handovers/", {
        params: status ? { status } : undefined,
    });
    return res.data;
}
/**
 * FOS: founder/authorized resolver decides a short drawer —
 * waive (company absorbs), recover (net from payroll), or escalate (investigate).
 * POST /api/pos/cash/handover/{id}/resolve/
 */
export async function resolveCashHandover(id, resolution, note) {
    const res = await getClient().post(`/api/pos/cash/handover/${id}/resolve/`, { resolution, note });
    return res.data;
}
/**
 * FOS: reconcile refund OTPs against the return bills they produced.
 * status="open" → only PENDING / AUTHORIZED_UNUSED (need attention).
 * GET /api/pos/authorize/refunds/
 */
export async function getRefundReconciliation(params) {
    const res = await getClient().get("/api/pos/authorize/refunds/", { params });
    return res.data;
}
/** POS: credit a customer's wallet with cash collected at the counter. */
export async function rechargeWallet(data) {
    const res = await getClient().post("/api/pos/wallet/recharge/", data);
    return res.data;
}
// ─── Shift Management ─────────────────────────────────────────────────
/**
 * Open a new POS shift.
 * POST /api/pos/shift/open/
 */
export async function openShift(data) {
    const res = await getClient().post("/api/pos/shift/open/", data);
    return res.data;
}
/**
 * Close the current POS shift.
 * POST /api/pos/shift/close/
 */
export async function closeShift(data) {
    const res = await getClient().post("/api/pos/shift/close/", data);
    return res.data;
}
/**
 * Get the current shift's summary (live stats).
 * GET /api/pos/shift/summary/
 */
export async function getShiftSummary() {
    const res = await getClient().get("/api/pos/shift/summary/");
    return res.data;
}
// ─── Settings ─────────────────────────────────────────────────────────
/**
 * Get POS terminal settings.
 * GET /api/pos/settings/
 */
export async function getPosSettings() {
    const res = await getClient().get("/api/pos/settings/");
    return res.data;
}
// ─── Product Catalog ──────────────────────────────────────────────────
/**
 * Get the POS product catalog (synced from inventory).
 * GET /api/pos/products/
 */
export async function getProducts(params) {
    const res = await getClient().get("/api/pos/products/", { params });
    return res.data;
}
/**
 * Look up customers by phone number (partial or full) for POS loyalty/PRIDE integration.
 * Returns a list of matching customers (B2B and Retail).
 * GET /api/pos/customers/lookup/
 */
export async function lookupCustomer(phone) {
    try {
        const res = await getClient().get("/api/pos/customers/lookup/", {
            params: { phone },
        });
        return res.data;
    }
    catch {
        return null;
    }
}
/**
 * Register a walk-in customer at the POS.
 * POST /api/pos/customers/
 */
export async function addCustomer(data) {
    const res = await getClient().post("/api/pos/customers/", data);
    return res.data;
}
// ─── Company (B2B) ────────────────────────────────────────────────────
/**
 * List B2B companies.
 * GET /api/pos/companies/
 */
export async function listCompanies() {
    const res = await getClient().get("/api/pos/companies/");
    return res.data;
}
/**
 * Register a B2B company.
 * POST /api/pos/companies/create/
 */
export async function createCompany(data) {
    const res = await getClient().post("/api/pos/companies/create/", data);
    return res.data;
}
// ─── Customer Transactions ────────────────────────────────────────────
/**
 * Search a customer's last transactions by phone for no-receipt returns.
 * GET /api/pos/orders/lookup/?phone=...
 */
export async function searchTransactionsByPhone(phone) {
    const res = await getClient().get("/api/pos/orders/lookup/", {
        params: { phone },
    });
    return res.data;
}
// ─── Orders ───────────────────────────────────────────────────────────
/**
 * Create a walk-in POS order.
 * POST /api/pos/orders/
 */
export async function createOrder(data) {
    const res = await getClient().post("/api/pos/orders/", data);
    return res.data;
}
// ─── Wastage ──────────────────────────────────────────────────────────
/**
 * Log a wastage entry.
 * POST /api/pos/wastage/
 */
export async function logWastage(data) {
    const res = await getClient().post("/api/pos/wastage/", data);
    return res.data;
}
/**
 * Get wastage entries for the current shift.
 * GET /api/pos/wastage/
 */
export async function getWastage() {
    const res = await getClient().get("/api/pos/wastage/");
    return res.data;
}
// ─── Returns & Refunds ────────────────────────────────────────────────
/**
 * Look up a past transaction by receipt ID for return processing.
 * GET /api/pos/orders/lookup/?receipt_id=...
 */
export async function lookupTransaction(receiptId) {
    const res = await getClient().get("/api/pos/orders/lookup/", { params: { receipt_id: receiptId } });
    return res.data;
}
/**
 * Process a return/refund for a past transaction.
 * Requires an OTP-verified manager authorization (action "refund").
 * POST /api/pos/orders/refund/
 */
export async function processRefund(data) {
    const res = await getClient().post("/api/pos/orders/refund/", data);
    return res.data;
}
/**
 * Request a manager authorization for a sensitive POS action.
 * Generates a one-time OTP that is pushed (FCM) to FOS users; the OTP is
 * never returned to the POS client.
 * POST /api/pos/authorize/request/
 */
export async function requestAuthorization(data) {
    const res = await getClient().post("/api/pos/authorize/request/", data);
    return res.data;
}
/**
 * Verify the OTP a FOS user relayed to the operator. On success the
 * authorization is consumed and can be used once for the refund/order.
 * POST /api/pos/authorize/verify/
 */
export async function verifyAuthorization(authorizationId, otp) {
    const res = await getClient().post("/api/pos/authorize/verify/", { authorization_id: authorizationId, otp });
    return res.data;
}
/** Outgoing operator starts a handover to a chosen colleague. */
export async function initiateShiftHandover(data) {
    const res = await getClient().post("/api/pos/cash/shift-handover/initiate/", data);
    return res.data;
}
/** Operators the drawer can be handed to (dropdown source). */
export async function availableOperators() {
    const res = await getClient().get("/api/pos/cash/shift-handover/available-operators/");
    return res.data.operators;
}
/** Pending handovers addressed to me (incoming operator's phone). */
export async function myIncomingHandovers() {
    const res = await getClient().get("/api/pos/cash/shift-handover/mine/");
    return res.data.offers;
}
/** My own PENDING handover (the one I initiated), so the POS can resume the
 *  "waiting for acceptance" state instead of trying to start a new one. */
export async function myOutgoingHandover() {
    const res = await getClient().get("/api/pos/cash/shift-handover/mine-outgoing/");
    return res.data.handover;
}
/** Incoming operator accepts on their device (identity-based, no code typing). */
export async function acceptShiftHandover(id, note) {
    const res = await getClient().post(`/api/pos/cash/shift-handover/${id}/accept/`, { note });
    return res.data;
}
/** Terminal polls its handover; on CONFIRMED the response carries the new operator's tokens. */
export async function handoverTokenStatus(id) {
    const res = await getClient().get(`/api/pos/cash/shift-handover/${id}/token-status/`);
    return res.data;
}
/** FOS authority: stuck PENDING drawer handovers blocking a cashier from reopening. */
export async function listPendingShiftHandovers() {
    const res = await getClient().get("/api/pos/cash/shift-handover/fos-pending/");
    return res.data;
}
/** FOS authority resolves a stuck handover: "take" the drawer (safe-drop) or
 *  "cancel" it (void) — either way the outgoing cashier is unblocked. */
export async function resolveShiftHandover(id, action, note) {
    const res = await getClient().post(`/api/pos/cash/shift-handover/${id}/fos-resolve/`, { action, note });
    return res.data;
}
//# sourceMappingURL=pos.js.map