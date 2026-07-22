import type { RazorpayInitRequest, RazorpayInitResponse, RazorpayVerifyRequest } from "../types";
/**
 * Initialize a Razorpay order for payment.
 * POST /api/payment/razorpay-init/
 *
 * NOTE: Total is calculated server-side from items — do NOT send amounts.
 */
export declare function initRazorpay(data: RazorpayInitRequest): Promise<RazorpayInitResponse>;
/**
 * Verify a completed Razorpay payment.
 * POST /api/payment/razorpay-verify/
 */
export declare function verifyPayment(data: RazorpayVerifyRequest): Promise<{
    message: string;
    status: string;
}>;
export interface RazorpayQRResponse {
    success: boolean;
    qr_id: string;
    image_url: string;
    amount: string;
    error?: string;
}
export interface RazorpayQRStatus {
    status: "PENDING" | "SUCCESS" | "FAILED";
    is_paid: boolean;
    qr_id: string;
    amount_received?: string;
}
/** Create a Razorpay UPI QR for the POS. POST /api/payment/razorpay/qr/ */
export declare function createRazorpayQR(amount: number, customerId?: string): Promise<RazorpayQRResponse>;
/** Read Razorpay QR payment status. GET /api/payment/razorpay/qr/status/ */
export declare function getRazorpayQRStatus(qrId: string): Promise<RazorpayQRStatus>;
/** Poll until the Razorpay QR resolves (paid/closed) or times out. */
export declare function pollRazorpayQR(qrId: string, onUpdate?: (s: RazorpayQRStatus) => void, maxAttempts?: number, intervalMs?: number): Promise<RazorpayQRStatus>;
//# sourceMappingURL=payment.d.ts.map