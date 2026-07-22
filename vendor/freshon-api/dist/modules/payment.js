// packages/freshon-api/src/modules/payment.ts
// Payment processing module — Razorpay init and verification.
// Maps to Django's apps/payment/ endpoints.
import { getClient } from "../client";
/**
 * Initialize a Razorpay order for payment.
 * POST /api/payment/razorpay-init/
 *
 * NOTE: Total is calculated server-side from items — do NOT send amounts.
 */
export async function initRazorpay(data) {
    const res = await getClient().post("/api/payment/razorpay-init/", data);
    return res.data;
}
/**
 * Verify a completed Razorpay payment.
 * POST /api/payment/razorpay-verify/
 */
export async function verifyPayment(data) {
    const res = await getClient().post("/api/payment/razorpay-verify/", data);
    return res.data;
}
const qrDelay = (ms) => new Promise((r) => setTimeout(r, ms));
/** Create a Razorpay UPI QR for the POS. POST /api/payment/razorpay/qr/ */
export async function createRazorpayQR(amount, customerId) {
    const res = await getClient().post("/api/payment/razorpay/qr/", {
        amount: amount.toFixed(2),
        customer_id: customerId ?? "",
    });
    return res.data;
}
/** Read Razorpay QR payment status. GET /api/payment/razorpay/qr/status/ */
export async function getRazorpayQRStatus(qrId) {
    const res = await getClient().get("/api/payment/razorpay/qr/status/", {
        params: { qr_id: qrId },
    });
    return res.data;
}
/** Poll until the Razorpay QR resolves (paid/closed) or times out. */
export async function pollRazorpayQR(qrId, onUpdate, maxAttempts = 75, intervalMs = 4000) {
    let last = { status: "PENDING", is_paid: false, qr_id: qrId };
    for (let i = 0; i < maxAttempts; i++) {
        try {
            last = await getRazorpayQRStatus(qrId);
            onUpdate?.(last);
            if (last.status !== "PENDING")
                return last;
        }
        catch {
            // transient — keep polling
        }
        await qrDelay(intervalMs);
    }
    return last;
}
//# sourceMappingURL=payment.js.map