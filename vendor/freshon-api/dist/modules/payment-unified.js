// packages/freshon-api/src/modules/payment-unified.ts
// Unified, vendor-agnostic payment module for the consumer app.
// The backend routes to the active vendor (ICICI or Razorpay) based on .env.
import { getClient } from "../client";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * Infer the payment vendor from a transaction reference string.
 * Razorpay order ids look like "order_xxxxxxxxxxxxxx".
 * ICICI merchantTxnNo is a numeric-ish 20-char string.
 */
export function inferVendor(transactionRef) {
    if (transactionRef.startsWith("order_"))
        return "razorpay";
    return "icici";
}
/**
 * Initiate payment for an existing order (vendor-agnostic).
 * Backend reads the active vendor from .env and returns a normalized response.
 */
export async function initiatePayment(orderId) {
    const res = await getClient().post("/api/payment/initiate/", {
        order_id: orderId,
    });
    return res.data;
}
/**
 * Get payment status (vendor-agnostic).
 * If vendor is omitted, the backend infers it from the transaction_ref format.
 */
export async function getPaymentStatus(transactionRef, vendor) {
    const params = { transaction_ref: transactionRef };
    if (vendor)
        params.vendor = vendor;
    const res = await getClient().get("/api/payment/status/", {
        params,
    });
    return res.data;
}
/**
 * Poll payment status until it resolves (SUCCESS / FAILED / REFUNDED / EXPIRED).
 * If vendor is omitted, it is inferred from the transaction_ref format.
 */
export async function pollPaymentUntilResolved(transactionRef, vendor, onUpdate, maxAttempts = 75, intervalMs = 4000) {
    const resolvedVendor = vendor ?? inferVendor(transactionRef);
    let last = {
        status: "PENDING",
        is_paid: false,
        transaction_ref: transactionRef,
        order_id: "",
        vendor: resolvedVendor,
    };
    for (let i = 0; i < maxAttempts; i++) {
        try {
            last = await getPaymentStatus(transactionRef, resolvedVendor);
            onUpdate?.(last);
            if (last.status !== "PENDING")
                return last;
        }
        catch {
            // transient — keep polling
        }
        await delay(intervalMs);
    }
    return last;
}
/**
 * Return the active payment vendor configured on the backend.
 */
export async function getActiveVendor() {
    const res = await getClient().get("/api/payment/vendor/");
    return res.data;
}
//# sourceMappingURL=payment-unified.js.map