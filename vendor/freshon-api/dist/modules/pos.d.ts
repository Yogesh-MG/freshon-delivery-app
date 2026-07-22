import type { PosLoginRequest, PosProduct, PosOrderRequest, PosTransaction, PosShiftOpenRequest, PosShiftCloseRequest, PosShiftSummary, PosWastageEntry, PosCustomer, PosSettings, PosCompanyProfile } from "../types";
/**
 * POS terminal login via employee ID + PIN.
 * POST /api/pos/login/
 */
export declare function posLogin(data: PosLoginRequest): Promise<{
    message: string;
    access: string;
    refresh: string;
    employee_name: string;
}>;
/**
 * Change the logged-in operator's own login PIN.
 * Requires the current PIN. POST /api/pos/change-pin/
 */
export declare function changePin(currentPin: string, newPin: string): Promise<{
    message: string;
}>;
/**
 * Verify the AUTHENTICATED operator's PIN server-side (PIN is stored hashed) to
 * unlock the idle screen lock. Works even after a handover token-swap, where no
 * PIN was typed on this terminal. `no_pin` = the operator has no PIN set, so the
 * caller should allow the unlock. POST /api/pos/verify-pin/
 */
export declare function verifyPin(pin: string): Promise<{
    valid: boolean;
    no_pin?: boolean;
}>;
export type DiscountLevel = "SUPERVISOR" | "AREA_MANAGER" | "FOUNDER";
export type DiscountStatus = "PENDING" | "APPROVED" | "REJECTED" | "DEFERRED" | "EXPIRED" | "CONSUMED" | "CANCELLED";
export type DiscountVerdict = "RECOMMEND" | "REVIEW" | "DECLINE";
export interface DiscountRecommendation {
    verdict: DiscountVerdict;
    suggested_pct: number;
    suggested_amount: number;
    score: number;
    reasons: string[];
}
export interface DiscountBillLine {
    name: string;
    qty: number;
    price: number;
}
export interface DiscountAuditEntry {
    event: string;
    at: string;
    by: string | null;
    detail: Record<string, unknown>;
}
export interface DiscountApproval {
    id: string;
    status: DiscountStatus;
    level: DiscountLevel;
    subtotal: number;
    requested_pct: number;
    requested_amount: number;
    approved_amount: number | null;
    /** The percentage the OS granted (derived from the approved amount). */
    approved_pct: number | null;
    final_amount: number;
    reason: string;
    hub: string | null;
    requested_by: string | null;
    founder_alerted: boolean;
    decision_note: string;
    /** Rule-based give/don't suggestion computed at request time. */
    recommendation?: DiscountRecommendation | null;
    /** The current bill the POS sent (subtotal + line items). */
    bill?: {
        subtotal: number;
        items: DiscountBillLine[];
    } | null;
    created_at: string;
    expires_at: string;
    customer?: Record<string, unknown>;
    audit_log?: DiscountAuditEntry[];
    over_budget?: boolean;
}
/**
 * POS: request a discount on the current bill → enters the FOS approval queue.
 * The POS no longer proposes a percentage; it sends the bill (+ optional reason)
 * and the OS originates the discount.
 */
export declare function requestDiscountApproval(data: {
    subtotal: number;
    reason?: string;
    items?: DiscountBillLine[];
    user_id?: string;
    customer_id?: string;
    phone?: string;
}): Promise<DiscountApproval>;
/** POS: poll a discount request for its decision. */
export declare function getDiscountStatus(id: string): Promise<DiscountApproval>;
/** FOS: pending approval queue (with customer history snapshot). */
export declare function getDiscountQueue(params?: {
    level?: DiscountLevel;
    hub?: string;
}): Promise<{
    pending: DiscountApproval[];
    count: number;
}>;
/**
 * FOS: act on a request — approve | reject | modify | defer.
 * On approve/modify the OS originates the discount via `pct` (preferred) or an
 * absolute `amount`.
 */
export declare function decideDiscount(id: string, action: "approve" | "reject" | "modify" | "defer", opts?: {
    pct?: number;
    amount?: number;
    note?: string;
}): Promise<DiscountApproval>;
/** POS: cancel a still-pending discount request. */
export declare function cancelDiscount(id: string, reason?: string): Promise<DiscountApproval>;
/** POS: confirm an approved discount was applied to a sale (completes the audit trail). */
export declare function confirmDiscountApplied(id: string, opts?: {
    order?: string;
}): Promise<DiscountApproval>;
/** Founder dashboard: hub budgets + per-approver stats this month. */
export declare function getDiscountBudget(): Promise<{
    hub_budgets: Array<{
        hub: string;
        hub_name: string;
        budget: number;
        used: number;
        remaining: number;
    }>;
    approver_stats: Array<{
        decided_by__username: string;
        count: number;
        total: number;
    }>;
}>;
export type CashDropStatus = "PENDING" | "ACKNOWLEDGED" | "REJECTED" | "EXPIRED";
export interface CashDrop {
    id: string;
    amount: number;
    recipient_name: string;
    requested_by: string | null;
    status: CashDropStatus;
    acknowledged_by: string | null;
    note: string;
    created_at: string;
    expires_at: string;
}
/** POS: create a cash drop acknowledgment request (cashier → authority). */
export declare function requestCashDrop(data: {
    amount: number;
    recipient_name: string;
}): Promise<CashDrop>;
/** POS: poll a cash drop request for its acknowledgment status. */
export declare function getCashDropStatus(id: string): Promise<CashDrop>;
/** POS: acknowledged cash-drop total for the current open shift (rehydrates the
 *  close screen so prior drops survive closing/reopening it). */
export declare function shiftCashDropTotal(): Promise<{
    total: number;
    drops: CashDrop[];
}>;
/** FOS: list pending cash drop requests. */
export declare function getCashDropQueue(): Promise<{
    pending: CashDrop[];
    count: number;
}>;
/** FOS: authority acknowledges or rejects a cash drop request. */
export declare function acknowledgeCashDrop(id: string, action: "acknowledge" | "reject", note?: string): Promise<CashDrop>;
export type ShiftCloseApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
export interface ShiftCloseApproval {
    id: string;
    status: ShiftCloseApprovalStatus;
    shift_id: string;
    expected_cash: number;
    declared_cash: number;
    variance: number;
    cash_drop_amount: number;
    recipient_name: string;
    denominations: Record<string, number>;
    notes: string;
    requested_by: string | null;
    requested_by_name: string | null;
    approved_by: string | null;
    decision_note: string;
    created_at: string;
    expires_at: string;
}
/** POS: cashier submits the day-end drawer count for remote authority approval. */
export declare function requestShiftCloseApproval(data: {
    declared_cash: number;
    denominations: Record<string, number>;
    cash_drop_amount?: number;
    recipient_name?: string;
    notes?: string;
}): Promise<ShiftCloseApproval>;
/** POS: poll a shift-close request for the authority's decision. */
export declare function getShiftCloseApprovalStatus(id: string): Promise<ShiftCloseApproval>;
/** FOS: list pending shift-close approvals. */
export declare function getShiftCloseApprovalQueue(): Promise<{
    pending: ShiftCloseApproval[];
    count: number;
}>;
/** How a manager reconciles an approved cash shortage. */
export type ShortageResolution = "recover_salary" | "company_absorb" | "other";
/**
 * FOS: authority approves (closing the shift) or rejects a close request.
 * When the drawer is SHORT and the authority approves anyway, the backend
 * requires `shortage_reason` + `shortage_resolution` (recover from the
 * employee's salary, company absorbs the loss, or hold/investigate).
 */
export declare function decideShiftCloseApproval(id: string, action: "approve" | "reject", note?: string, shortage?: {
    reason: string;
    resolution: ShortageResolution;
}): Promise<ShiftCloseApproval>;
export type CashHandoverStatus = "PENDING_HANDOVER" | "BALANCED" | "OVER" | "SHORT_REVIEW" | "RESOLVED" | "ESCALATED";
export type CashHandoverResolution = "WAIVED" | "RECOVERED" | "ESCALATED";
export interface CashHandover {
    id: string;
    shift_id: string;
    employee_id: number | null;
    employee: string | null;
    employee_name: string | null;
    expected_cash: string;
    declared_cash: string;
    counted_cash: string | null;
    variance: string;
    shortage: string;
    status: CashHandoverStatus;
    resolution: CashHandoverResolution | "";
    resolution_note: string;
    received_by: string | null;
    decision_id: string | null;
    created_at: string;
    handed_over_at: string | null;
    resolved_at: string | null;
}
/**
 * FOS: list shift-end cash handovers (day-end drawer reviews).
 * Pass status="open" for only the ones needing attention
 * (pending handover, short review, escalated).
 * GET /api/pos/cash/handovers/
 */
export declare function listCashHandovers(status?: "open" | CashHandoverStatus): Promise<CashHandover[]>;
/**
 * FOS: founder/authorized resolver decides a short drawer —
 * waive (company absorbs), recover (net from payroll), or escalate (investigate).
 * POST /api/pos/cash/handover/{id}/resolve/
 */
export declare function resolveCashHandover(id: string, resolution: CashHandoverResolution, note?: string): Promise<CashHandover>;
export type RefundReconciliationStatus = "PENDING" | "AUTHORIZED_UNUSED" | "COMPLETED" | "EXPIRED";
export interface RefundReturnBill {
    transaction_id: string;
    invoice_number: string;
    /** Absolute refunded amount (positive). */
    total: string;
    method: string;
    created_at: string;
    items: {
        name: string;
        quantity: string;
        unit_price: string;
    }[];
}
export interface RefundReconciliationEntry {
    authorization_id: string;
    reconciliation: RefundReconciliationStatus;
    operator: string | null;
    /** FOS user whose OTP authorized the refund (if identifiable). */
    authorized_by: string | null;
    original_transaction_id: string | null;
    refund_method: string | null;
    amount: string | null;
    item_count: number | null;
    created_at: string;
    consumed_at: string | null;
    claimed_at: string | null;
    /** The generated return bill — present once the refund actually completed. */
    return_bill: RefundReturnBill | null;
}
/**
 * FOS: reconcile refund OTPs against the return bills they produced.
 * status="open" → only PENDING / AUTHORIZED_UNUSED (need attention).
 * GET /api/pos/authorize/refunds/
 */
export declare function getRefundReconciliation(params?: {
    status?: "open";
    days?: number;
}): Promise<{
    results: RefundReconciliationEntry[];
    count: number;
    unused_count: number;
}>;
export interface WalletRechargeResult {
    success: boolean;
    /** Display reference, e.g. "WR-000042". */
    transaction_id: string;
    amount: number;
    previous_balance: number;
    new_balance: number;
    customer_name: string;
    customer_phone: string;
    /** True if a new walk-in customer account was created for this phone. */
    customer_created: boolean;
    created_at: string;
}
/** POS: credit a customer's wallet with cash collected at the counter. */
export declare function rechargeWallet(data: {
    phone_number: string;
    amount: number;
}): Promise<WalletRechargeResult>;
/**
 * Open a new POS shift.
 * POST /api/pos/shift/open/
 */
export declare function openShift(data: PosShiftOpenRequest): Promise<{
    message: string;
    shift_id: string;
}>;
/**
 * Close the current POS shift.
 * POST /api/pos/shift/close/
 */
export declare function closeShift(data: PosShiftCloseRequest): Promise<PosShiftSummary>;
/**
 * Get the current shift's summary (live stats).
 * GET /api/pos/shift/summary/
 */
export declare function getShiftSummary(): Promise<PosShiftSummary>;
/**
 * Get POS terminal settings.
 * GET /api/pos/settings/
 */
export declare function getPosSettings(): Promise<PosSettings>;
/**
 * Get the POS product catalog (synced from inventory).
 * GET /api/pos/products/
 */
export declare function getProducts(params?: {
    category?: string;
    search?: string;
}): Promise<PosProduct[]>;
export interface CustomerLookupResponse {
    results: PosCustomer[];
}
/**
 * Look up customers by phone number (partial or full) for POS loyalty/PRIDE integration.
 * Returns a list of matching customers (B2B and Retail).
 * GET /api/pos/customers/lookup/
 */
export declare function lookupCustomer(phone: string): Promise<CustomerLookupResponse | null>;
/**
 * Register a walk-in customer at the POS.
 * POST /api/pos/customers/
 */
export declare function addCustomer(data: {
    name: string;
    phone: string;
    email?: string;
}): Promise<PosCustomer>;
/**
 * List B2B companies.
 * GET /api/pos/companies/
 */
export declare function listCompanies(): Promise<PosCompanyProfile[]>;
/**
 * Register a B2B company.
 * POST /api/pos/companies/create/
 */
export declare function createCompany(data: {
    name: string;
    gstin: string;
    address?: string;
    pan?: string;
    email?: string;
}): Promise<PosCompanyProfile>;
/**
 * Search a customer's last transactions by phone for no-receipt returns.
 * GET /api/pos/orders/lookup/?phone=...
 */
export declare function searchTransactionsByPhone(phone: string): Promise<PosTransaction[]>;
/**
 * Create a walk-in POS order.
 * POST /api/pos/orders/
 */
export declare function createOrder(data: PosOrderRequest): Promise<PosTransaction>;
/**
 * Log a wastage entry.
 * POST /api/pos/wastage/
 */
export declare function logWastage(data: PosWastageEntry): Promise<{
    message: string;
    id: string;
}>;
/**
 * Get wastage entries for the current shift.
 * GET /api/pos/wastage/
 */
export declare function getWastage(): Promise<PosWastageEntry[]>;
/**
 * Look up a past transaction by receipt ID for return processing.
 * GET /api/pos/orders/lookup/?receipt_id=...
 */
export declare function lookupTransaction(receiptId: string): Promise<PosTransaction & {
    transaction_type: string;
}>;
export interface PosRefundRequest {
    original_transaction_id: string;
    /** Id of an OTP-verified manager authorization (see requestAuthorization/verifyAuthorization). */
    authorization_id: string;
    items: {
        pid: string;
        quantity: number;
    }[];
    refund_method: "Cash" | "UPI" | "Card" | "Sodexo" | "Wallet";
}
export interface PosRefundResponse extends PosTransaction {
    transaction_type: "RETURN";
    original_transaction_id: string;
    authorized_by: string;
}
/**
 * Process a return/refund for a past transaction.
 * Requires an OTP-verified manager authorization (action "refund").
 * POST /api/pos/orders/refund/
 */
export declare function processRefund(data: PosRefundRequest): Promise<PosRefundResponse>;
export type PosAuthorizationAction = "refund" | "discount";
export interface PosAuthorizationRequest {
    action: PosAuthorizationAction;
    /** Human/audit context shown in the FOS push: amount, receipt_id, discount_pct, reason… */
    context?: Record<string, unknown>;
}
export interface PosAuthorizationResponse {
    authorization_id: string;
    action: PosAuthorizationAction;
    expires_at: string;
    /** Number of FOS devices the OTP was pushed to. */
    delivered_to: number;
}
export interface PosAuthorizationVerifyResponse {
    verified: boolean;
    action: PosAuthorizationAction;
    authorization_id: string;
}
/**
 * Request a manager authorization for a sensitive POS action.
 * Generates a one-time OTP that is pushed (FCM) to FOS users; the OTP is
 * never returned to the POS client.
 * POST /api/pos/authorize/request/
 */
export declare function requestAuthorization(data: PosAuthorizationRequest): Promise<PosAuthorizationResponse>;
/**
 * Verify the OTP a FOS user relayed to the operator. On success the
 * authorization is consumed and can be used once for the refund/order.
 * POST /api/pos/authorize/verify/
 */
export declare function verifyAuthorization(authorizationId: string, otp: string): Promise<PosAuthorizationVerifyResponse>;
export interface HandoverOperator {
    id: string;
    employee_id: string;
    name: string;
    on_shift: boolean;
}
export interface ShiftHandover {
    id: string;
    status: "PENDING" | "CONFIRMED" | "REJECTED" | "ESCALATED" | "SAFE_DROPPED" | "EXPIRED";
    declared_cash: string;
    expected_cash: string;
    variance: string;
    outgoing_employee?: string | null;
    outgoing_employee_name?: string | null;
    incoming_employee?: string | null;
    incoming_employee_name?: string | null;
    from_name?: string;
    handover_code?: string;
    created_at: string;
    tokens?: {
        access: string;
        refresh: string;
        employee_name: string;
        opening_cash: number;
    };
}
/** Outgoing operator starts a handover to a chosen colleague. */
export declare function initiateShiftHandover(data: {
    declared_cash: number;
    declared_digital?: number;
    incoming_employee_id: string;
    note?: string;
}): Promise<ShiftHandover>;
/** Operators the drawer can be handed to (dropdown source). */
export declare function availableOperators(): Promise<HandoverOperator[]>;
/** Pending handovers addressed to me (incoming operator's phone). */
export declare function myIncomingHandovers(): Promise<ShiftHandover[]>;
/** My own PENDING handover (the one I initiated), so the POS can resume the
 *  "waiting for acceptance" state instead of trying to start a new one. */
export declare function myOutgoingHandover(): Promise<ShiftHandover | null>;
/** Incoming operator accepts on their device (identity-based, no code typing). */
export declare function acceptShiftHandover(id: string, note?: string): Promise<ShiftHandover>;
/** Terminal polls its handover; on CONFIRMED the response carries the new operator's tokens. */
export declare function handoverTokenStatus(id: string): Promise<ShiftHandover>;
/** FOS authority: stuck PENDING drawer handovers blocking a cashier from reopening. */
export declare function listPendingShiftHandovers(): Promise<ShiftHandover[]>;
/** FOS authority resolves a stuck handover: "take" the drawer (safe-drop) or
 *  "cancel" it (void) — either way the outgoing cashier is unblocked. */
export declare function resolveShiftHandover(id: string, action: "take" | "cancel", note?: string): Promise<ShiftHandover>;
//# sourceMappingURL=pos.d.ts.map