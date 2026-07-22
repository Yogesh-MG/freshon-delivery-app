export type SettlementModel = "OUTRIGHT" | "SALE_OR_RETURN";
export type SupplierStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export interface Supplier {
    id: string;
    name: string;
    legal_name?: string;
    gstin?: string;
    fssai_license?: string;
    organic_cert_body?: string;
    organic_cert_number?: string;
    organic_cert_expiry?: string | null;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    status: SupplierStatus;
    settlement_model: SettlementModel;
    default_gst_rate: string;
    payment_terms_days: number;
    agreement_signed: boolean;
    account_name?: string;
    account_number?: string;
    ifsc_code?: string;
    upi_id?: string;
    ledger_balance: string;
    created_at: string;
}
export interface SupplierRegistrationRequest {
    phone: string;
    otp?: string;
}
export interface SupplierAuthResponse {
    message: string;
    is_new_user: boolean;
    supplier_linked: boolean;
    supplier: Supplier | null;
    user?: {
        id: number;
        username: string;
        name: string;
        role: string | null;
    };
    access?: string;
    refresh?: string;
}
export interface SupplierDashboard {
    supplier_name: string;
    status: SupplierStatus;
    settlement_model: SettlementModel;
    ledger_balance: number;
    lifetime_credits: number;
    total_deductions: number;
    spoilage_deductions: number;
    active_batches: number;
    total_batches: number;
    total_orders: number;
    items_sold_30d: number;
    open_consignments: number;
    pending_invoices: number;
}
export interface ConsignmentItem {
    id?: number;
    variant?: number | null;
    declared_product_name?: string;
    product_name?: string;
    declared_quantity: string | number;
    unit: string;
    is_prepackaged: boolean;
    agreed_price: string | number;
    mrp?: string | number | null;
    harvest_date?: string | null;
    best_before?: string | null;
}
export interface Consignment {
    id: string;
    consignment_number: string;
    supplier: string;
    supplier_name: string;
    status: "DRAFT" | "SUBMITTED" | "RECEIVING" | "RECEIVED" | "CANCELLED";
    expected_date?: string | null;
    supplier_invoice_number?: string;
    declared_total_value?: string | null;
    notes?: string;
    items: ConsignmentItem[];
    created_at: string;
}
export interface CreateConsignmentRequest {
    expected_date?: string | null;
    supplier_invoice_number?: string;
    notes?: string;
    items: ConsignmentItem[];
}
export type LedgerEntryType = "GOODS_ACCEPTED" | "RECEIPT_SHORTFALL" | "QC_REJECTION" | "POST_ACCEPTANCE_SPOILAGE" | "RETURN_DEBIT" | "PENALTY" | "ADVANCE" | "SETTLEMENT_PAID" | "ADJUSTMENT";
export interface LedgerEntry {
    id: string;
    entry_type: LedgerEntryType;
    entry_type_display: string;
    amount: string;
    balance_before: string;
    balance_after: string;
    notes?: string;
    created_at: string;
}
export interface LedgerResponse {
    balance: number;
    entries: LedgerEntry[];
}
export interface SupplierInvoice {
    id: string;
    invoice_number: string;
    period_start: string;
    period_end: string;
    gross_amount: string;
    deductions_amount: string;
    gst_amount: string;
    net_amount: string;
    status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
    paid_at?: string | null;
    transaction_ref?: string;
    created_at: string;
}
export interface SupplierDocument {
    id: string;
    doc_type: "GST" | "FSSAI" | "ORGANIC_CERT" | "AGREEMENT" | "OTHER";
    url: string | null;
    expiry_date?: string | null;
    is_verified: boolean;
    uploaded_at: string;
}
/** Two-step phone-OTP login for supplier contacts. POST /api/supplier/register/ */
export declare function registerSupplier(data: SupplierRegistrationRequest): Promise<SupplierAuthResponse>;
export declare function getProfile(): Promise<Supplier>;
export declare function updateProfile(data: Partial<Supplier>): Promise<Supplier>;
export declare function getDashboard(): Promise<SupplierDashboard>;
export declare function listConsignments(): Promise<Consignment[]>;
export declare function createConsignment(data: CreateConsignmentRequest): Promise<Consignment>;
export declare function getLedger(): Promise<LedgerResponse>;
export declare function listInvoices(): Promise<SupplierInvoice[]>;
export declare function listDocuments(): Promise<SupplierDocument[]>;
/** FOS admin: suppliers awaiting approval. GET /api/supplier/fos/approvals/ */
export declare function listSupplierApprovals(): Promise<{
    pending: Supplier[];
    count: number;
}>;
/**
 * FOS admin: approve or reject a supplier.
 * POST /api/supplier/fos/approvals/{supplierId}/decide/
 * approve → ACTIVE, reject → SUSPENDED.
 */
export declare function decideSupplierApproval(supplierId: string, action: "approve" | "reject"): Promise<Supplier>;
export declare function uploadDocument(docType: SupplierDocument["doc_type"], file: File | Blob, expiryDate?: string): Promise<SupplierDocument>;
//# sourceMappingURL=supplier.d.ts.map