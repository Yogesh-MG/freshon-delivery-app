export type ICICIPaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED" | "ERROR";
export interface PGInitiateResponse {
    success: boolean;
    payment_url: string;
    merchant_txn_no: string;
    order_id: string;
    upi_url: string | null;
}
export interface PGStatusResponse {
    status: ICICIPaymentStatus | "REFUNDED";
    order_id: string;
    is_paid: boolean;
    merchant_txn_no: string;
}
export interface PGPosInitiateResponse {
    success: boolean;
    payment_url: string;
    merchant_txn_no: string;
    upi_url: string | null;
}
/**
 * Initiate an ICICI PG Direct sale from the POS — no pre-existing order needed.
 * POST /api/payment/icici-pg/pos-initiate/
 * Returns the hosted-page URL to display as a QR code in Fpos.
 * Customer scans → opens ICICI payment page on phone → pays via UPI/Card/NB.
 */
export declare function initiatePGPosSale(amount: number, customerId?: string): Promise<PGPosInitiateResponse>;
/**
 * Initiate an ICICI PG Direct sale for an already-created (unpaid) order.
 * POST /api/payment/icici-pg/initiate/  — amount is taken from the order server-side.
 */
export declare function initiatePGSale(orderId: string): Promise<PGInitiateResponse>;
import type { ICICIGenerateQRResponse } from "../types";
/**
 * Generate a dynamic UPI QR via ICICI PG generateQR.
 * POST /api/payment/icici-pg/qr/
 *   - orderId given → amount is taken from the order server-side (links it).
 *   - else → POS mode: pass an explicit amount (no order needed).
 */
export declare function generateQR(amount: number, orderId?: string, customerId?: string): Promise<ICICIGenerateQRResponse>;
/** Read the HMAC-verified payment status. GET /api/payment/icici-pg/status/ */
export declare function getPGStatus(merchantTxnNo: string): Promise<PGStatusResponse>;
/** Poll the backend until the PG payment resolves (or times out). */
export declare function pollPGUntilResolved(merchantTxnNo: string, onUpdate?: (s: PGStatusResponse) => void, maxAttempts?: number, intervalMs?: number): Promise<PGStatusResponse>;
//# sourceMappingURL=icici.d.ts.map