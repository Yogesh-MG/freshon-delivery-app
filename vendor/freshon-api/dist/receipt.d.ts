export interface ReceiptStore {
    name: string;
    addressLines: string[];
    phone: string;
    gstin: string;
    fssai: string;
}
/** The live store identity printed on every FreshOn receipt. */
export declare const FRESHON_STORE: ReceiptStore;
export interface ReceiptLineItem {
    name: string;
    /** Printed in the MRP column (integer). */
    unitPrice: number;
    quantity: number;
    /** Line amount (post-discount). */
    amount: number;
    /** GST % for this line; drives the GST summary box. 0/undefined = excluded. */
    gstRate?: number;
    /** Weighed items render quantity with one decimal. */
    weighed?: boolean;
}
export interface ReceiptTender {
    method: string;
    amount: number;
}
export interface ReceiptData {
    invoiceNumber: string;
    timestamp: string | number | Date;
    items: ReceiptLineItem[];
    subtotal: number;
    total: number;
    tenders: ReceiptTender[];
    customerName?: string;
    customerPhone?: string;
    /** B2B company line (name + GSTIN). */
    company?: {
        name: string;
        gstin: string;
    } | null;
    isReturn?: boolean;
    isAnonymous?: boolean;
    isPride?: boolean;
    /** Actual amount saved (PRIDE). */
    memberDiscount?: number;
    /** Discount fraction used to advertise potential savings (default 0.30). */
    prideDiscountPct?: number;
    walletCreditAmount?: number;
    roundingAdjustment?: number;
    /** Delivery fee line — online orders only; the POS bill has none. */
    deliveryFee?: number;
    /** When set, prints an "Order Type : <label>" meta line (consumer bills). */
    orderTypeLabel?: string;
    /** Override the printed store identity (defaults to FRESHON_STORE). */
    store?: ReceiptStore;
}
interface GstBucket {
    rate: number;
    taxableValue: number;
    cgstRate: number;
    cgstAmt: number;
    sgstRate: number;
    sgstAmt: number;
    totalGst: number;
}
/** GST is charged inclusive of price: taxable = amount / (1 + rate/100). */
export declare function computeGstBuckets(items: ReceiptLineItem[]): GstBucket[];
/**
 * Build the tagged receipt text for one transaction. The output is consumed by
 * each app's ReceiptPreview renderer and by the Rust thermal printer.
 */
export declare function buildReceiptText(data: ReceiptData): string;
export {};
//# sourceMappingURL=receipt.d.ts.map