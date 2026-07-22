// packages/freshon-api/src/modules/icici.ts
import { getClient } from "../client";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * Initiate an ICICI PG Direct sale from the POS — no pre-existing order needed.
 * POST /api/payment/icici-pg/pos-initiate/
 * Returns the hosted-page URL to display as a QR code in Fpos.
 * Customer scans → opens ICICI payment page on phone → pays via UPI/Card/NB.
 */
export async function initiatePGPosSale(amount, customerId) {
    const res = await getClient().post("/api/payment/icici-pg/pos-initiate/", { amount: amount.toFixed(2), customer_id: customerId ?? "" });
    return res.data;
}
/**
 * Initiate an ICICI PG Direct sale for an already-created (unpaid) order.
 * POST /api/payment/icici-pg/initiate/  — amount is taken from the order server-side.
 */
export async function initiatePGSale(orderId) {
    const res = await getClient().post("/api/payment/icici-pg/initiate/", { order_id: orderId });
    return res.data;
}
/**
 * Generate a dynamic UPI QR via ICICI PG generateQR.
 * POST /api/payment/icici-pg/qr/
 *   - orderId given → amount is taken from the order server-side (links it).
 *   - else → POS mode: pass an explicit amount (no order needed).
 */
export async function generateQR(amount, orderId, customerId) {
    const body = {};
    if (orderId)
        body.order_id = orderId;
    else
        body.amount = amount.toFixed(2);
    if (customerId)
        body.customer_id = customerId;
    const res = await getClient().post("/api/payment/icici-pg/qr/", body);
    return res.data;
}
/** Read the HMAC-verified payment status. GET /api/payment/icici-pg/status/ */
export async function getPGStatus(merchantTxnNo) {
    const res = await getClient().get("/api/payment/icici-pg/status/", { params: { merchant_txn_no: merchantTxnNo } });
    return res.data;
}
/** Poll the backend until the PG payment resolves (or times out). */
export async function pollPGUntilResolved(merchantTxnNo, onUpdate, maxAttempts = 75, intervalMs = 4000) {
    let last = {
        status: "PENDING",
        order_id: "",
        is_paid: false,
        merchant_txn_no: merchantTxnNo,
    };
    for (let i = 0; i < maxAttempts; i++) {
        try {
            last = await getPGStatus(merchantTxnNo);
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
//# sourceMappingURL=icici.js.map