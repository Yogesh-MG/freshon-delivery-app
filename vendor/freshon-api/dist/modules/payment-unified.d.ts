export type PaymentVendor = "icici" | "razorpay";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "EXPIRED";
export interface InitiatePaymentResponse {
    success: boolean;
    payment_url: string;
    transaction_ref: string;
    vendor: PaymentVendor;
    order_id: string;
    upi_url?: string;
    metadata?: Record<string, unknown>;
    error?: string;
}
export interface PaymentStatusResponse {
    status: PaymentStatus;
    is_paid: boolean;
    transaction_ref: string;
    order_id: string;
    vendor: PaymentVendor;
    error?: string;
}
export interface VendorInfoResponse {
    vendor: PaymentVendor;
    supported: PaymentVendor[];
}
/**
 * Infer the payment vendor from a transaction reference string.
 * Razorpay order ids look like "order_xxxxxxxxxxxxxx".
 * ICICI merchantTxnNo is a numeric-ish 20-char string.
 */
export declare function inferVendor(transactionRef: string): PaymentVendor;
/**
 * Initiate payment for an existing order (vendor-agnostic).
 * Backend reads the active vendor from .env and returns a normalized response.
 */
export declare function initiatePayment(orderId: string): Promise<InitiatePaymentResponse>;
/**
 * Get payment status (vendor-agnostic).
 * If vendor is omitted, the backend infers it from the transaction_ref format.
 */
export declare function getPaymentStatus(transactionRef: string, vendor?: PaymentVendor): Promise<PaymentStatusResponse>;
/**
 * Poll payment status until it resolves (SUCCESS / FAILED / REFUNDED / EXPIRED).
 * If vendor is omitted, it is inferred from the transaction_ref format.
 */
export declare function pollPaymentUntilResolved(transactionRef: string, vendor?: PaymentVendor, onUpdate?: (s: PaymentStatusResponse) => void, maxAttempts?: number, intervalMs?: number): Promise<PaymentStatusResponse>;
/**
 * Return the active payment vendor configured on the backend.
 */
export declare function getActiveVendor(): Promise<VendorInfoResponse>;
//# sourceMappingURL=payment-unified.d.ts.map