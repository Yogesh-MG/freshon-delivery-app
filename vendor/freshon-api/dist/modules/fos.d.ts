export interface FosKpis {
    ordersToday: {
        value: number;
        deltaPct: number;
    };
    activeDeliveries: {
        express: number;
        sameDay: number;
    };
    delayedOrders: {
        value: number;
        severity: "high" | "medium" | "low";
    };
    openTickets: {
        value: number;
        slaBreaching: number;
    };
    revenueToday: {
        value: number;
        deltaPct: number;
    };
}
export interface FosHourlySale {
    time: string;
    gmv: number;
    orders: number;
}
export interface FosBankStatement {
    id: string;
    date: string;
    description: string;
    credit: number;
    debit: number;
    status: "Reconciled" | "Unmatched" | "Pending";
}
export interface FosReceivable {
    id: string;
    partner: string;
    received: number;
    pending: number;
    aging: {
        d30: number;
        d60: number;
        d90: number;
    };
}
export interface FosEmployeeAddress {
    permanent: string;
    temporary?: string;
}
export interface FosEmployeeEducation {
    school: string;
    college?: string;
    highestQualification?: string;
}
export interface FosEmployeeExperience {
    previousCompany?: string;
    previousRole?: string;
    experienceYears?: number;
}
export interface FosEmployeeAttachment {
    id: string;
    type: "id_proof" | "certificate" | "offer_letter" | "other";
    name: string;
    url: string;
    uploadedAt: string;
    size: number;
}
export interface FosEmployeeOnboarding {
    parentName?: string;
    addresses: FosEmployeeAddress;
    /** Repeatable — HR can record multiple education entries / prior jobs. Older
     *  records may still hold a single object; readers should normalize to array. */
    education: FosEmployeeEducation[];
    experience: FosEmployeeExperience[];
    attachments: FosEmployeeAttachment[];
    emergencyContact?: {
        name: string;
        phone: string;
        relationship: string;
    };
}
export type FosEmploymentType = "FULL_TIME" | "PART_TIME";
export interface FosEmployee {
    id: string;
    name: string;
    role: string;
    dailyRate: number;
    daysPresent: number;
    unpaidLeaves: number;
    total: number;
    status: "Present" | "Late" | "Leave" | "Absent";
    employmentType?: FosEmploymentType;
    familyBackground?: string;
    onboarding?: FosEmployeeOnboarding;
    phone?: string;
    email?: string;
    joinedAt?: string;
}
/** A scanned/uploaded HR document. Unassigned ones form the scan inbox. */
export interface FosScannedDocument {
    id: string;
    doc_type: "ID_PROOF" | "CERTIFICATE" | "OFFER_LETTER" | "OTHER";
    name: string;
    url: string;
    size: number;
    source: "SCAN" | "UPLOAD";
    employee: string | null;
    is_assigned: boolean;
    created_at: string;
}
export interface FosLeave {
    id: string;
    name: string;
    role: string;
    from: string;
    to: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
}
export interface FosOrder {
    id: string;
    customer: string;
    area: string;
    item: string;
    amount: number;
    status: "Processing" | "Express" | "Delivered" | "Delayed" | "Escalated" | "Unpaid";
    order_type?: "ONLINE" | "POS";
    risk: number;
    placedAt: string;
}
export interface FosOrderTimelineStep {
    key: string;
    label: string;
    at: string | null;
    /** Employee (picker) or driver credited with this step; null for
     * system-driven steps (placed/confirmed) or when nobody's assigned yet. */
    by: string | null;
    done: boolean;
}
export interface FosOrderDetail {
    id: string;
    order_type: "ONLINE" | "POS";
    status: FosOrder["status"];
    raw_status: string;
    /** The actual status enum value (e.g. "SHIPPED") — raw_status above is a
     * human label ("Out for Delivery") for display, not for round-tripping to
     * updateFosOrderStatus. Use this for the status-override <select>. */
    status_code: FosOrderStatusValue;
    placed_at: string | null;
    updated_at: string | null;
    remark: string;
    risk: {
        score: number;
        level: "High" | "Med" | "Low";
        factors: string[];
    };
    customer: {
        name: string;
        phone: string;
        email: string;
        total_orders: number;
        cancelled_orders: number;
        is_new: boolean;
    };
    items: Array<{
        name: string;
        quantity: number;
        unit: string;
        price: number;
        line_total: number;
        weight_grams: number | null;
    }>;
    money: {
        subtotal: number;
        member_discount: number;
        delivery_fee: number;
        total: number;
        wallet_amount_used: number;
        remaining_amount: number;
        payment_method: string;
        /** Raw payment enum — PENDING | PROCESSING | COMPLETED | FAILED | REFUNDED. */
        payment_status: string;
        is_paid: boolean;
        /** Gateway/UTR txn reference, or the one a founder recorded on a manual reconciliation. */
        payment_reference: string;
    };
    timeline: FosOrderTimelineStep[];
    delivery: {
        address_title: string;
        address_line: string;
        area: string;
        slot: string;
        latitude: number | null;
        longitude: number | null;
        partner_name: string;
        partner_phone: string;
        vehicle: string;
        /** Booking platform (Porter / Uber / Local) captured on a manual FOS booking. */
        platform: string;
        booking_note: string;
        booking_confirmed_at: string | null;
        assignment_status: string | null;
        courier_partner: string | null;
        waybill_number: string | null;
        bag_count: number | null;
        packing_photo_url: string;
        proof_of_delivery_url: string;
    };
    impact: {
        water: number;
        soil: number;
        chemical: number;
        farmer: number;
    };
}
export interface FosTicket {
    id: string;
    customer: string;
    phone?: string;
    subject: string;
    category: string;
    sentiment: "angry" | "frustrated" | "happy";
    slaRemaining: number;
    channel?: "APP" | "WHATSAPP";
    liveHandoff?: boolean;
    status?: string;
    relatedOrder?: string;
    lastMessage: string;
}
export interface TicketAttachment {
    kind: string;
    url: string;
    filename?: string;
    mime_type?: string;
    size?: number;
    media_id?: string;
    caption?: string;
}
export interface TicketMessage {
    id: number;
    ticket_id: string;
    sender_type: "customer" | "agent" | "system";
    sender_name: string;
    message: string;
    attachments?: TicketAttachment[];
    /** Agent-only note (e.g. "Customer requested a human agent."). Never sent to the customer. */
    is_internal?: boolean;
    created_at: string;
}
export interface TicketMessagesResponse {
    ticket_id: string;
    ticket_status: string;
    messages: TicketMessage[];
    count: number;
    /** True when this ticket came out of a Sprout chat that can be read for context. */
    has_ai_transcript?: boolean;
}
/** One turn of the Sprout conversation that happened BEFORE the ticket existed. */
export interface AiTranscriptMessage {
    id: number;
    /** `customer` = what they typed; `ai` = what Sprout replied. */
    role: "customer" | "ai";
    message: string;
    attachments?: TicketAttachment[];
    created_at: string;
}
export interface AiTranscriptResponse {
    ticket_id: string;
    has_transcript: boolean;
    /** Present only when `has_transcript` is false — why there is nothing to show. */
    reason?: string;
    session_id?: string;
    started_at?: string;
    messages: AiTranscriptMessage[];
    count: number;
}
export interface SendTicketMessageRequest {
    sender_type: "customer" | "agent" | "system";
    message: string;
    is_internal?: boolean;
}
export interface FosInventoryItem {
    id: string;
    name: string;
    cat: string;
    /** Stock level in GRAMS for weight goods (convert to kg for display). */
    stock: number;
    /** Variant pack unit, e.g. "1 kg", "500 g", "1 dozen". Drives kg/piece formatting. */
    unit: string;
    /** Per-product low-stock alert level, same unit as `stock` (grams/count). */
    low_stock_threshold: number;
    price: number;
    /** Finished variant packs physically on the active picking shelf (ready to sell). */
    shelf_packs?: number | null;
    /** Finished variant packs held in warehouse cold storage. */
    warehouse_packs?: number | null;
    expiry: string;
    demand7d: number[];
    /** True when stock is 0 — lets the "All" view badge out-of-stock items. */
    is_out_of_stock: boolean;
    /** True when stock is at or below the product's low_stock_threshold. */
    is_low_stock: boolean;
}
/** Which slice of inventory the FOS list shows. */
export type FosInventoryView = "available" | "all" | "low_stock";
export interface FosDeadStockItem {
    sku: string;
    item: string;
    velocity: string;
    suggestedAction: string;
}
export interface FosPOSource {
    type: "farmer" | "supplier";
    id: string;
    name: string;
    phone: string | null;
    farm_name: string;
}
export interface FosPOFacility {
    id: string;
    name: string;
    type: string | null;
}
/**
 * What happens to a PO's stock once it lands, chosen by the founder at approval.
 * - GO_LIVE     receiving publishes `selling_price` onto the variant
 * - REPACK      stock feeds the raw pool; each pack size is priced by packing
 * - PRICE_LATER stock lands, catalog price untouched (pricing engine decides)
 */
export type FosPOListingMode = "GO_LIVE" | "REPACK" | "PRICE_LATER";
export type FosPOStatus = "PENDING" | "APPROVED" | "REJECTED" | "RECEIVED";
/**
 * One product LINE of a purchase order.
 *
 * A PO document (`FosPOGroup`) has N of these — each with its own product, batch,
 * rate, HSN and GST. The line is still the unit the warehouse receives and the
 * ledger pays against; the group is what the vendor is sent.
 */
export interface FosPurchaseOrder {
    id: string;
    po_number: string;
    status: FosPOStatus;
    /** The document this line belongs to. Null only for legacy sourceless POs. */
    group_id: string | null;
    /** The number printed on the document. Falls back to po_number when ungrouped. */
    group_number: string;
    /** 1-based position of this line on its document. */
    line_index: number;
    farmer: {
        id: string | null;
        name: string;
        phone: string | null;
        farm_name: string;
    };
    source?: FosPOSource | null;
    facility?: FosPOFacility | null;
    batch: {
        id: string;
        variant_id?: string;
        product: string;
        variant: string;
        stock_level: number;
    };
    quantity: number;
    /** Taxable LINE TOTAL for the whole order (unit_rate * num_units). */
    purchase_price: number | null;
    /** Buying cost of ONE variant pack. This is the basis every price screen uses. */
    purchase_price_per_pack: number | null;
    /** quantity / variant.weight_grams. Null when the variant has no net weight. */
    pack_count: number | null;
    /** Retail price of ONE variant pack. */
    selling_price: number | null;
    mrp: number | null;
    gst_rate: number;
    is_gst_inclusive: boolean;
    /** What receiving does with this stock. Only GO_LIVE publishes selling_price. */
    listing_mode: FosPOListingMode;
    po_date: string | null;
    valid_until: string | null;
    unit_basis: string;
    unit_rate: number | null;
    num_units: number | null;
    transport_mode: string;
    transport_doc_ref: string;
    destination: string;
    bill_to: string;
    ship_to: string;
    hsn_code: string;
    product_code: string;
    terms: string;
    sent_at: string | null;
    sent_via: string;
    source_gst: FosPartyGst;
    seller: FosSellerIdentity;
    tax: FosPoTax;
    created_at: string;
    approved_at: string | null;
    approved_by: string | null;
}
export interface FosPartyGst {
    gstin: string;
    state: string;
    legal_name: string;
    address: string;
}
export interface FosSellerIdentity {
    legal_name: string;
    gstin: string;
    state_code: string;
    address: string;
}
export interface FosPoTax {
    taxable_value: number;
    gst_rate: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    tax_amount: number;
    total: number;
    is_interstate: boolean;
}
export interface FosPOProduct {
    id: string;
    name: string;
    hsn_code: string;
    gst_rate: number | null;
    /** Category / sub-category the PO product picker narrows by. */
    category: string | null;
    category_name: string;
    subcategory: string | null;
    subcategory_name: string;
    /**
     * Pack sizes — INCLUDING inactive ones, unlike the selling-side `variants` list.
     *
     * `weight_grams` is the net weight of ONE pack, 0 when unknown — the only honest
     * bridge from a count basis ("150 piece") to the grams stock is held in, so the PO
     * form needs it to show the conversion up front.
     *
     * `is_active` is a SELLING flag ("offer this pack in POS/online"), not a buying one.
     * The pack you purchase in is often one you took off sale — loose eggs — so the PO
     * form lists off-sale packs and labels them rather than hiding them.
     */
    variants: {
        id: string;
        unit: string;
        sku: string;
        price: number;
        weight_grams: number;
        is_active: boolean;
    }[];
}
export interface FosPOSupplierOption {
    id: string;
    name: string;
    legal_name: string;
    gstin: string;
    state: string;
    address: string;
    phone: string;
}
export interface FosPOOptions {
    farmers: {
        id: string;
        name: string;
        farm_name: string;
        phone: string | null;
    }[];
    suppliers: FosPOSupplierOption[];
    variants: {
        id: string;
        product: string;
        unit: string;
        sku: string;
        price: number;
        mrp: number | null;
    }[];
    products: FosPOProduct[];
    warehouses: {
        id: string;
        name: string;
        type: string | null;
        address: string;
    }[];
    seller: FosSellerIdentity;
}
export interface FosCreatePORequest {
    product_id?: string;
    variant_id?: string;
    quantity_grams?: number;
    purchase_price?: number;
    farmer_id?: string;
    supplier_id?: string;
    facility_id?: string;
    is_organic?: boolean;
    harvest_date?: string;
    selling_price?: number;
    mrp?: number;
    gst_rate?: number;
    is_gst_inclusive?: boolean;
    po_date?: string;
    valid_until?: string;
    unit_basis?: string;
    unit_rate?: number;
    num_units?: number;
    transport_mode?: string;
    transport_doc_ref?: string;
    destination?: string;
    bill_to?: string;
    ship_to?: string;
    hsn_code?: string;
    product_code?: string;
    terms?: string;
    /**
     * The product lines. A multi-product PO sends these; omit them and the flat
     * fields above are treated as a single line (the legacy shape).
     */
    items?: FosPOLineInput[];
}
/** One product line of a PO being raised. */
export interface FosPOLineInput {
    product_id?: string;
    variant_id?: string;
    /**
     * Expected quantity in grams. Send this for a WEIGHT/VOLUME basis (kg, litre…).
     *
     * OMIT it for a COUNT basis (piece, pack, dozen…) and send `num_units` instead:
     * the server converts the count using the variant's real net weight, which the
     * client doesn't know. Guessing here is what once booked 100 packs of tissue in
     * as 100 kg.
     */
    quantity_grams?: number;
    /** Taxable LINE TOTAL for THIS line (unit_rate * num_units), not a per-pack rate. */
    purchase_price: number;
    unit_basis?: string;
    unit_rate?: number;
    num_units?: number;
    hsn_code?: string;
    product_code?: string;
    gst_rate?: number;
    is_gst_inclusive?: boolean;
    is_organic?: boolean;
}
/** Tax totals for a whole PO document — summed PER LINE, since GST is per line. */
export interface FosPOTotals {
    taxable_value: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    tax_amount: number;
    total: number;
}
/**
 * A purchase order DOCUMENT: one vendor, one number, N product lines.
 *
 * This is what FOS lists, prints, sends and approves. The header fields below are
 * shared by every line (they are stored on the lines; the backend reads them off
 * the first). `status` is DERIVED from the lines — any line still pending holds the
 * whole document at PENDING.
 */
export interface FosPOGroup {
    id: string;
    group_number: string;
    status: FosPOStatus;
    source: FosPOSource | null;
    source_gst: FosPartyGst;
    seller: FosSellerIdentity;
    facility: FosPOFacility | null;
    po_date: string | null;
    valid_until: string | null;
    transport_mode: string;
    transport_doc_ref: string;
    destination: string;
    bill_to: string;
    ship_to: string;
    terms: string;
    sent_at: string | null;
    sent_via: string;
    lines: FosPurchaseOrder[];
    line_count: number;
    totals: FosPOTotals;
    created_at: string;
}
/** One line's pricing decision at approval. All prices are PER VARIANT PACK. */
export interface FosApprovePOLine {
    po_id: string;
    purchase_price_per_pack?: number;
    selling_price?: number;
    mrp?: number;
    gst_rate?: number;
    is_gst_inclusive?: boolean;
    listing_mode?: FosPOListingMode;
}
/** One line's actual received weight at the hub. Omit to accept the expected qty. */
export interface FosReceivePOLine {
    po_id: string;
    actual_quantity?: number;
}
export interface FosSendPOResponse {
    success: boolean;
    whatsapp_delivered: boolean;
    message: string;
    sent_at: string;
}
export interface FosApprovePOResponse {
    success: boolean;
    message: string;
    po: {
        id: string;
        po_number: string;
        status: string;
        /** Taxable line total, derived server-side from the per-pack cost. */
        purchase_price: number | null;
        purchase_price_per_pack: number | null;
        pack_count: number | null;
        selling_price: number | null;
        mrp: number | null;
        gst_rate: number;
        is_gst_inclusive: boolean;
        listing_mode: FosPOListingMode;
        approved_at: string;
        approved_by: string | null;
    };
}
export interface FosReceivePOResponse {
    success: boolean;
    message: string;
    po: {
        id: string;
        po_number: string;
        status: string;
    };
    batch: {
        id: string;
        is_approved: boolean;
        approved_at: string;
    };
    variant: {
        id: number;
        price: number;
        mrp: number | null;
        gst_rate: number;
        is_gst_inclusive: boolean;
    };
    serialized_items: Array<{
        id: string;
        barcode: string;
    }>;
    barcodes_generated: number;
}
export interface FosBarcodeValidationResponse {
    valid: boolean;
    barcode_type?: "serialized_item" | "weighed_item";
    item?: {
        id: string;
        barcode: string;
        status: string;
        current_zone: string;
    };
    product: {
        id: number;
        name: string;
        category: string | null;
        unit: string;
    };
    pricing: {
        price: number;
        mrp: number | null;
        gst_rate: number;
        is_gst_inclusive: boolean;
    };
    batch?: {
        id: string;
        harvest_date: string;
        is_organic: boolean;
        expiry_status: string;
    };
    farmer?: {
        id: string;
        name: string;
        farm_name: string;
    };
    weight?: {
        grams: number;
        display: string;
    };
    error?: string;
}
export interface FosStockReconciliationResponse {
    success: boolean;
    message: string;
    reconciliation: {
        batch_id: string;
        product: string;
        variant: string;
        category: string | null;
        recorded_weight: number;
        actual_weight: number;
        weight_difference: number;
        loss_percentage: number;
    };
    tolerance_check: {
        category_is_perishable: boolean;
        tolerance_percentage: number | null;
        is_within_tolerance: boolean;
    };
    shrinkage_log: {
        id: string;
        quantity_logged: number;
        reason: string;
    } | null;
}
export interface FosShrinkageReportResponse {
    period: string;
    date_from: string;
    summary: {
        total_shrinkage_quantity: number;
        total_shrinkage_value: number;
        shrinkage_entries: number;
    };
    top_products_by_shrinkage: Array<{
        product: string;
        total_quantity: number;
        total_value: number;
        entries: number;
    }>;
    recent_entries: Array<{
        id: string;
        product: string;
        quantity: number;
        value: number;
        created_at: string;
    }>;
}
export interface FosAgentResponse {
    agent: string;
    steps: string[];
    text: string;
    chart: Array<{
        day: string;
        gmv: number;
    }>;
    rich?: any;
    /** AgentSession id the turn was stored under (for history + AI training). */
    session_id?: string;
}
export interface FosActiveDelivery {
    assignmentId: string;
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerPhone?: string;
    status: "PROCESSING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "AT_RISK" | "DELAYED";
    sourceLat: number;
    sourceLng: number;
    destLat: number;
    destLng: number;
    /** Best-known current position — real GPS, real destination, or an approximate estimate. */
    currentLat: number;
    currentLng: number;
    /** True when destLat/destLng/currentLat/currentLng are a guess, not a real geocode. */
    isApproximate: boolean;
    /** True when an FOS operator should confirm/correct this delivery (isApproximate and not yet verified). */
    needsVerification: boolean;
    positionSource: "gps" | "address" | "estimated";
    driverId?: string;
    driverName?: string;
    driverPhone?: string;
    /** Driver's fee/earnings for this delivery, used to derive a real "cost / order" figure. */
    driverFee?: number;
    slaMinutes: number;
    slaRemainingMinutes: number;
    items: string[];
}
export interface FosInsight {
    tone: "warn" | "info" | "danger";
    title: string;
    body: string;
}
export interface FosNotification {
    m: string;
    c: "danger" | "warn" | "ok" | "ai" | "primary";
    t: string;
}
/**
 * Get dashboard KPIs.
 * GET /api/pos/fos/dashboard/kpis/
 */
export declare function getDashboardKpis(): Promise<FosKpis>;
export type FosRevenueRange = "Today" | "7D" | "30D" | "QTR" | "YR";
/** REAL period revenue (summed from actual orders — no extrapolation). Only what
 * the data honestly supports: GMV, orders, AOV, online/POS split. Net-of-GST,
 * gross profit and margin are intentionally NOT here (imported sales carry no GST
 * or cost) — the UI must show those as "—". */
export interface FosRevenueByRange {
    range: FosRevenueRange;
    gmv: number;
    orders: number;
    aov: number;
    onlinePct: number;
    posPct: number;
}
/** GET /api/pos/fos/dashboard/revenue/?range=... — real GMV/orders for the window. */
export declare function getRevenueByRange(range: FosRevenueRange): Promise<FosRevenueByRange>;
/**
 * Get hourly sales data for today.
 * GET /api/pos/fos/dashboard/hourly-sales/
 */
export declare function getHourlySales(): Promise<FosHourlySale[]>;
export interface FosFinanceSummary {
    cash_position: number;
    banks: string[];
    partner_count: number;
    reconciled_pct: number;
    overdue_accounts: number;
}
/**
 * Top-tile finance KPIs (cash position, partner count, reconciliation %, overdue).
 * GET /api/pos/fos/finance/summary/
 */
export declare function getFinanceSummary(): Promise<FosFinanceSummary>;
/**
 * Get bank statement sync log.
 * GET /api/pos/fos/finance/bank-statements/
 */
export declare function getBankStatements(): Promise<FosBankStatement[]>;
/**
 * Get receivables with aging buckets.
 * GET /api/pos/fos/finance/receivables/
 */
export declare function getReceivables(): Promise<FosReceivable[]>;
/**
 * Send WhatsApp/SMS reminder to a partner.
 * POST /api/pos/fos/finance/send-reminder/
 */
export declare function sendReminder(data: {
    partner_id: string;
    partner_name: string;
}): Promise<{
    success: boolean;
    message: string;
    channels: string[];
    timestamp: string;
}>;
/**
 * Get employees with attendance and payroll data.
 * GET /api/pos/fos/hr/employees/
 */
export declare function getEmployees(): Promise<FosEmployee[]>;
/**
 * Get leave requests.
 * GET /api/pos/fos/hr/leaves/
 */
export declare function getLeaves(): Promise<FosLeave[]>;
/**
 * Update leave request status (approve/reject).
 * PATCH /api/pos/fos/hr/leaves/
 */
export declare function updateLeaveStatus(data: {
    leave_id: string;
    status: "approved" | "rejected";
}): Promise<{
    success: boolean;
    leave_id: string;
    status: string;
    updated_at: string;
}>;
/**
 * Process payroll and queue transfers.
 * POST /api/pos/fos/hr/process-payroll/
 */
export declare function processPayroll(): Promise<{
    success: boolean;
    message: string;
    total_amount: number;
    employee_count: number;
    batch_id: string;
    timestamp: string;
}>;
/**
 * Get smart orders with AI risk scoring (legacy: full array, up to 500 recent).
 * GET /api/pos/fos/orders/?status=&search=
 */
export declare function getFosOrders(params?: {
    status?: string;
    search?: string;
}): Promise<FosOrder[]>;
export interface FosOrdersPage {
    results: FosOrder[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
}
/**
 * Get smart orders one page at a time (lazy pagination). Open orders sort first.
 * GET /api/pos/fos/orders/?page=&page_size=&status=&search=&order_type=
 */
export declare function getFosOrdersPaged(params?: {
    status?: string;
    search?: string;
    order_type?: string;
    page?: number;
    page_size?: number;
}): Promise<FosOrdersPage>;
/**
 * Full detail for one order (Smart Orders popup).
 * GET /api/pos/fos/orders/<tracking_id>/
 */
export declare function getFosOrderDetail(trackingId: string): Promise<FosOrderDetail>;
/** Order lifecycle statuses a founder can set from the order detail (full override). */
export type FosOrderStatusValue = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
/**
 * Founder/admin manual override of an order's status (e.g. to update the delivery
 * status of a manually-delivered order). Returns the refreshed order detail.
 * PATCH /api/pos/fos/orders/<tracking_id>/
 */
export declare function updateFosOrderStatus(trackingId: string, status: FosOrderStatusValue): Promise<FosOrderDetail>;
/** Payment statuses a founder can set when reconciling an order by hand. */
export type FosPaymentStatusValue = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
/**
 * Founder/admin manual payment reconciliation — mark an unpaid / failed /
 * escalated order's payment status and record the transaction id that came in
 * out-of-band. Setting COMPLETED flips is_paid. Audit-logged server-side.
 * Returns the refreshed order detail.
 * PATCH /api/pos/fos/orders/<tracking_id>/
 */
export declare function updateFosOrderPayment(trackingId: string, input: {
    payment_status: FosPaymentStatusValue;
    transaction_id?: string;
}): Promise<FosOrderDetail>;
/**
 * Download all matching orders (current filters, every page) as a CSV blob.
 * GET /api/pos/fos/orders/?export=csv
 */
export declare function exportFosOrdersCsv(params?: {
    status?: string;
    search?: string;
    order_type?: string;
}): Promise<Blob>;
/**
 * Get support tickets with SLA and sentiment.
 * GET /api/pos/fos/support/tickets/
 */
export declare function getTickets(): Promise<FosTicket[]>;
/**
 * Generate AI reply for a ticket.
 * POST /api/pos/fos/support/ai-reply/
 */
export declare function generateAiReply(data: {
    ticket_id: string;
    sentiment: "angry" | "frustrated" | "happy" | "neutral";
}): Promise<{
    ticket_id: string;
    replies: string[];
    generated_at: string;
}>;
/**
 * Get inventory with AI demand predictions.
 * GET /api/pos/fos/inventory/
 */
export declare function getFosInventory(params?: {
    view?: FosInventoryView;
    search?: string;
    limit?: number;
}): Promise<FosInventoryItem[]>;
/** Founder/admin override of an inventory item. All fields optional. */
export interface FosInventoryUpdate {
    /** Absolute stock level in GRAMS (weight goods) or count (piece goods). */
    stock?: number;
    /** Variant selling price (₹). Also the live storefront price for this variant. */
    price?: number;
    /** Per-product low-stock alert level. */
    low_stock_threshold?: number;
}
/**
 * Override an inventory item's stock / price / threshold (founder & admin only).
 * Backend gates this with IsFounderOrAdmin and audits every change.
 * PATCH /api/pos/fos/inventory/  body: { id, ...fields }
 */
export declare function updateFosInventoryItem(id: string, body: FosInventoryUpdate): Promise<FosInventoryItem>;
export interface FosVariantRow {
    variant_id: number;
    batch_id: number | null;
    unit: string;
    price: number;
    mrp: number | null;
    is_active: boolean;
    stock: number;
    /** Net grams in one sellable pack (0 = loose/unknown). >0 → stock can be shown
     *  as a pack count: packs = stock / unit_grams. Optional for back-compat. */
    unit_grams?: number;
    shelf_packs: number;
    warehouse_packs: number;
}
export interface FosProductVariants {
    product_id: number;
    name: string;
    category: string;
    /** True → one shared gram pool (`pool_grams`) all variants draw from. */
    shared_stock: boolean;
    low_stock_threshold: number;
    pool_grams: number | null;
    /** Product-level RAW bulk material (grams) not yet packed into retail packs.
     *  Packing draws it down and mints packs of a chosen variant. */
    raw_stock_grams: number;
    variants: FosVariantRow[];
}
export interface FosVariantUpdate {
    variant_id: number;
    price?: number;
    stock?: number;
}
export interface FosProductVariantsUpdate {
    product_id: number;
    low_stock_threshold?: number;
    pool_grams?: number;
    raw_stock_grams?: number;
    variants?: FosVariantUpdate[];
}
/** All of a product's pack-size variants (by any of its batch ids) for the editor. */
export declare function getFosProductVariants(batchId: string): Promise<FosProductVariants>;
/** Bulk-update a product's variant prices + stock (or shared pool). Founder/admin. */
export declare function updateFosProductVariants(body: FosProductVariantsUpdate): Promise<FosProductVariants>;
export interface PackFromRawResponse {
    barcodes: string[];
    packed: number;
    /** Product raw pool remaining after the pack (grams). */
    raw_stock_grams: number;
}
/**
 * Pack `count` retail packs of a variant out of the PRODUCT-LEVEL raw pool.
 * Draws count × per-pack weight from Product.raw_stock_grams and mints that many
 * finished serialized packs (on the shelf) for the variant.
 * POST /api/pos/fos/inventory/pack/  body: { product_id, variant_id, count }
 */
export declare function packFromRawPool(productId: number, variantId: number, count: number): Promise<PackFromRawResponse>;
export interface FosInventorySummary {
    skus_active: number;
    low_stock: number;
    expiring_48h: number;
}
/**
 * Active-inventory KPI tiles (counts over all approved in-stock batches).
 * GET /api/pos/fos/inventory/summary/
 */
export declare function getFosInventorySummary(): Promise<FosInventorySummary>;
/**
 * Get dead stock and slow movers.
 * GET /api/pos/fos/inventory/dead-stock/
 */
export declare function getDeadStock(): Promise<FosDeadStockItem[]>;
/**
 * Query the AI agent.
 * POST /api/pos/fos/agent/query/
 */
export declare function queryAgent(data: {
    message: string;
    agent_type?: string;
    /** Reuse an existing FOUNDER_BI thread so the turn is stored in one session. */
    session_id?: string;
}): Promise<FosAgentResponse>;
/**
 * Get all Purchase Orders.
 * GET /api/pos/fos/purchase-orders/?status=
 */
export declare function getPurchaseOrders(params?: {
    status?: "PENDING" | "APPROVED" | "REJECTED" | "RECEIVED";
}): Promise<FosPurchaseOrder[]>;
/**
 * Form options for raising a PO: farmers, suppliers, active variants, warehouses.
 * GET /api/pos/fos/purchase-orders/options/
 */
export declare function getPurchaseOrderOptions(): Promise<FosPOOptions>;
/**
 * Raise a procurement Purchase Order — one vendor, one or more products.
 *
 * Pass `items: [...]` for a multi-product PO; the flat single-product shape still
 * works and is treated as a one-line document. Either way this returns the whole
 * PO document (a pending batch + PENDING PO line per product).
 *
 * POST /api/pos/fos/purchase-orders/create/
 */
export declare function createPurchaseOrder(data: FosCreatePORequest): Promise<FosPOGroup>;
export interface FosPOGroupsPage {
    results: FosPOGroup[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
    counts: {
        ALL: number;
        PENDING: number;
        APPROVED: number;
        REJECTED: number;
        RECEIVED: number;
    };
}
/**
 * PO documents, newest first, one page at a time — this is what the FOS PO
 * list renders. GET /api/pos/fos/purchase-orders/groups/?status=&page=&page_size=
 */
export declare function fetchPurchaseOrderGroups(params?: {
    status?: FosPOStatus;
    page?: number;
    page_size?: number;
}): Promise<FosPOGroupsPage>;
/**
 * One PO document with all its product lines.
 * GET /api/pos/fos/purchase-orders/groups/<group_id>/
 */
export declare function fetchPurchaseOrderGroup(groupId: string): Promise<FosPOGroup>;
/**
 * Edit a PENDING PO document — its header, vendor, and product lines.
 *
 * The lines are REPLACED by `items`, so this is how products are added, removed and
 * reordered. Safe only while PENDING (nothing has been priced or received yet). The
 * group keeps its number, since the vendor may already have been sent it.
 *
 * PATCH /api/pos/fos/purchase-orders/groups/<group_id>/
 */
export declare function updatePurchaseOrderGroup(groupId: string, data: FosCreatePORequest): Promise<FosPOGroup>;
/**
 * Approve a whole PO document. Every line is priced independently — different
 * products, different costs, different GST — so `lines` carries a decision each.
 * All prices are PER VARIANT PACK. Atomic: one bad line approves none of them.
 *
 * POST /api/pos/fos/purchase-orders/groups/<group_id>/approve/
 */
export declare function approvePurchaseOrderGroup(groupId: string, lines: FosApprovePOLine[]): Promise<FosPOGroup>;
/**
 * Reject a whole PENDING PO document. Already-approved lines are left alone.
 * POST /api/pos/fos/purchase-orders/groups/<group_id>/reject/
 */
export declare function rejectPurchaseOrderGroup(groupId: string): Promise<FosPOGroup>;
/**
 * Receive a whole PO document at the hub. Each product is weighed separately, so
 * the actual quantity is per line. Omit `lines` to receive every approved line at
 * its expected quantity.
 *
 * POST /api/pos/fos/purchase-orders/groups/<group_id>/receive/
 */
export declare function receivePurchaseOrderGroup(groupId: string, lines?: FosReceivePOLine[]): Promise<{
    success: boolean;
    message: string;
    group: FosPOGroup;
}>;
/**
 * Send a whole PO document to its vendor as ONE WhatsApp message listing every line.
 * POST /api/pos/fos/purchase-orders/groups/<group_id>/send/
 */
export declare function sendPurchaseOrderGroup(groupId: string): Promise<FosSendPOResponse>;
/**
 * Edit a PENDING Purchase Order before approval (fix scanned/auto-created POs).
 * PATCH /api/pos/fos/purchase-orders/<po_id>/
 */
export declare function updatePurchaseOrder(poId: string, data: Partial<FosCreatePORequest>): Promise<FosPurchaseOrder>;
/**
 * Send a Purchase Order to its source (supplier/farmer) over WhatsApp.
 * POST /api/pos/fos/purchase-orders/<po_id>/send/
 */
export declare function sendPurchaseOrder(poId: string): Promise<FosSendPOResponse>;
/**
 * Reject a PENDING Purchase Order.
 * POST /api/pos/fos/purchase-orders/<po_id>/reject/
 */
export declare function rejectPurchaseOrder(poId: string): Promise<{
    success: boolean;
    message: string;
    po: {
        id: string;
        po_number: string;
        status: string;
    };
}>;
/**
 * Approve a Purchase Order with pricing and GST configuration.
 * POST /api/pos/fos/purchase-orders/<po_id>/approve/
 *
 * Every price here is PER VARIANT PACK. The taxable line total is derived
 * server-side from the pack count — never send a total.
 */
export declare function approvePurchaseOrder(poId: string, data: {
    /** Buying cost of ONE pack. Legacy `purchase_price` (a line total) still works. */
    purchase_price_per_pack?: number;
    /** Retail price of ONE pack. Required when listing_mode is GO_LIVE. */
    selling_price?: number;
    mrp?: number;
    gst_rate?: number;
    is_gst_inclusive?: boolean;
    listing_mode?: FosPOListingMode;
}): Promise<FosApprovePOResponse>;
/**
 * Receive a Purchase Order (mark stock as arrived at warehouse).
 * POST /api/pos/fos/purchase-orders/<po_id>/receive/
 */
export declare function receivePurchaseOrder(poId: string): Promise<FosReceivePOResponse>;
/**
 * Validate a scanned barcode.
 * GET /api/pos/fos/inventory/barcode/validate/?barcode=
 */
export declare function validateBarcode(barcode: string): Promise<FosBarcodeValidationResponse>;
/**
 * Perform stock reconciliation on an inventory batch.
 * Adjusts stock level and logs shrinkage for moisture loss.
 * POST /api/pos/fos/inventory/reconcile/
 */
export declare function reconcileStock(data: {
    batch_id: string;
    actual_weight: number;
    reason?: string;
    notes?: string;
}): Promise<FosStockReconciliationResponse>;
/**
 * Get shrinkage report for a period.
 * GET /api/pos/fos/inventory/shrinkage-report/?period=
 */
export declare function getShrinkageReport(params?: {
    period?: "today" | "this_week" | "this_month";
    category?: string;
}): Promise<FosShrinkageReportResponse>;
/**
 * Get active deliveries for the live operational map.
 * GET /api/pos/fos/dashboard/active-deliveries/
 */
export declare function getActiveDeliveries(): Promise<FosActiveDelivery[]>;
export interface FosVerifyDeliveryPayload {
    status?: "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
    note?: string;
    correctedLat?: number;
    correctedLng?: number;
}
/**
 * FOS operator confirms/corrects a delivery the live-ops map could only
 * track approximately (or just signs off on any active delivery).
 * POST /api/pos/fos/dashboard/active-deliveries/{assignmentId}/verify/
 */
export declare function verifyDelivery(assignmentId: string, payload: FosVerifyDeliveryPayload): Promise<FosActiveDelivery>;
/**
 * Get dynamic operational/AI insights.
 * GET /api/pos/fos/dashboard/insights/
 */
export declare function getDashboardInsights(): Promise<FosInsight[]>;
/**
 * Get live operational/system notifications.
 * GET /api/pos/fos/dashboard/notifications/
 */
export declare function getDashboardNotifications(): Promise<FosNotification[]>;
/**
 * Create a new employee (User + EmployeeProfile + SalaryStructure).
 * POST /api/hr/employees/
 */
export declare function createEmployee(data: {
    name: string;
    role: string;
    dailyRate: number;
    status: "Present" | "Late" | "Leave" | "Absent";
    employmentType?: FosEmploymentType;
    familyBackground?: string;
    phone?: string;
    email?: string;
    onboarding?: FosEmployeeOnboarding;
    /** Scanned-inbox document ids to assign to the new hire on creation. */
    documentIds?: string[];
}): Promise<FosEmployee>;
/**
 * List HR documents. Pass { unassigned: true } for the scan inbox, or
 * { employee } for one employee's documents.
 * GET /api/hr/documents/
 */
export declare function getScannedDocuments(params?: {
    unassigned?: boolean;
    employee?: string;
}): Promise<FosScannedDocument[]>;
/**
 * Assign an inbox document to an employee (and/or set its type).
 * PATCH /api/hr/documents/<id>/
 */
export declare function assignDocument(documentId: string, data: {
    employee?: string;
    doc_type?: FosScannedDocument["doc_type"];
}): Promise<FosScannedDocument>;
/**
 * Discard a scanned document.
 * DELETE /api/hr/documents/<id>/
 */
export declare function deleteDocument(documentId: string): Promise<void>;
export interface FosSettings {
    pride_discount_pct: number;
    rounding_enabled: boolean;
    rounding_slab: number;
    max_manual_discount_pct: number;
    ops_has_finance_access: boolean;
    ops_has_hr_access: boolean;
    ops_has_po_approval_access: boolean;
    hub_lat: number;
    hub_lng: number;
}
export interface FosModule {
    id: number;
    codename: string;
    name: string;
    description: string;
    is_active: boolean;
}
export type FosPermissionType = "view" | "add" | "change" | "delete" | "approve" | "export" | "manage";
export interface FosPermission {
    id: number;
    codename: string;
    name: string;
    permission_type: FosPermissionType;
    description: string;
    module: FosModule;
}
export interface FosRole {
    id: number;
    name: string;
    description: string;
    permissions: FosPermission[];
    /**
     * WRITE-ONLY. The permission ids this role should hold, replacing whatever it
     * holds now. Send this to change what a role can DO; `permissions` above is the
     * read-back. (Editing `hidden_features` changes only what a role can SEE.)
     */
    permission_ids?: number[];
    /** Sidebar feature keys (route paths, e.g. "/finance") HIDDEN for this role. Founder-controlled. */
    hidden_features: string[];
    is_active: boolean;
    is_system_role: boolean;
    permission_count?: number;
    created_at: string;
}
/** One staff member on the Access Control screen, with the FOS roles they hold. */
export interface FosPermissionEmployee {
    /** EmployeeProfile primary key — what `assignEmployeeRole` expects. */
    id: number;
    /** Human-facing code, e.g. "EMP-001". */
    employee_id: string;
    name: string;
    /** The account role (FOUNDER / MANAGER / …), which is not the same as a FOS role. */
    account_role: string;
    is_manager: boolean;
    fos_roles: {
        assignment_id: number;
        role_id: number;
        role_name: string;
    }[];
}
export interface FosEmployeePermission {
    id: number;
    employee: number;
    employee_name: string;
    permission: FosPermission;
    is_active: boolean;
    is_effective: boolean;
    expires_at: string | null;
    granted_by: number | null;
    granted_by_name: string | null;
    granted_at: string;
    notes: string;
}
export interface FosEmployeeRole {
    id: number;
    employee: number;
    employee_name: string;
    role: FosRole;
    is_active: boolean;
    granted_by: number | null;
    granted_by_name: string | null;
    granted_at: string;
}
export interface FosUserPermissions {
    user_id: number;
    username: string;
    is_superuser: boolean;
    permissions: string[];
    permissions_detail: Array<{
        codename: string;
        name: string;
        permission_type: FosPermissionType;
        module__codename: string;
        module__name: string;
    }>;
    legacy_permissions: {
        ops_has_finance_access: boolean;
        ops_has_hr_access: boolean;
        ops_has_po_approval_access: boolean;
    };
    employee?: {
        id: number;
        employee_id: string;
        is_active: boolean;
        is_manager: boolean;
    };
    roles: Array<{
        id: number;
        name: string;
        granted_at: string;
    }>;
    /** Effective sidebar feature keys hidden for this user (intersection across their roles; empty for superusers). */
    hidden_features: string[];
}
export interface FosPermissionCheckRequest {
    permission?: string;
    permissions?: string[];
    require_all?: boolean;
}
export interface FosPermissionCheckResponse {
    has_permission: boolean;
    checked: string[];
    require_all?: boolean;
}
export interface FosModuleAccessResponse {
    module: string;
    has_access: boolean;
}
export interface FosEmployeePermissionsSummary {
    employee: {
        id: number;
        employee_id: string;
        name: string;
        is_active: boolean;
    };
    direct_permissions: Array<{
        id: number;
        codename: string;
        name: string;
        module: string;
        type: FosPermissionType;
        is_effective: boolean;
        expires_at: string | null;
    }>;
    roles: Array<{
        id: number;
        name: string;
        granted_at: string;
    }>;
    effective_permissions: string[];
    effective_permissions_detail: FosUserPermissions["permissions_detail"];
}
/**
 * Get FOS settings.
 * GET /api/pos/settings/
 */
export declare function getSettings(): Promise<FosSettings>;
/**
 * Update FOS settings.
 * POST /api/pos/settings/
 */
export declare function updateSettings(data: Partial<FosSettings>): Promise<FosSettings>;
/**
 * Get current user's FOS permissions.
 * GET /api/pos/fos/permissions/me/
 */
export declare function getCurrentUserPermissions(): Promise<FosUserPermissions>;
/**
 * Check if user has specific permission(s).
 * POST /api/pos/fos/permissions/check/
 */
export declare function checkPermission(data: FosPermissionCheckRequest): Promise<FosPermissionCheckResponse>;
/**
 * Check if user has access to a module.
 * GET /api/pos/fos/permissions/check-module/<module_codename>/
 */
export declare function checkModuleAccess(moduleCodename: string): Promise<FosModuleAccessResponse>;
/**
 * List all FOS modules.
 * GET /api/pos/fos/permissions/modules/
 */
export declare function getFosModules(): Promise<FosModule[]>;
/**
 * List all FOS permissions.
 * GET /api/pos/fos/permissions/permissions/
 */
export declare function getFosPermissions(params?: {
    module?: string;
    type?: FosPermissionType;
}): Promise<FosPermission[]>;
/**
 * List all FOS roles.
 * GET /api/pos/fos/permissions/roles/
 */
export declare function getFosRoles(): Promise<FosRole[]>;
/**
 * Create a new FOS role.
 * POST /api/pos/fos/permissions/roles/
 */
export declare function createFosRole(data: Partial<FosRole>): Promise<FosRole>;
/**
 * Get FOS role details.
 * GET /api/pos/fos/permissions/roles/<id>/
 */
export declare function getFosRole(id: number): Promise<FosRole>;
/**
 * Update FOS role.
 * PATCH /api/pos/fos/permissions/roles/<id>/
 */
export declare function updateFosRole(id: number, data: Partial<FosRole>): Promise<FosRole>;
/**
 * Delete FOS role.
 * DELETE /api/pos/fos/permissions/roles/<id>/
 */
export declare function deleteFosRole(id: number): Promise<void>;
/**
 * List employee permissions.
 * GET /api/pos/fos/permissions/employee-permissions/
 */
export declare function getEmployeePermissions(params?: {
    employee_id?: string;
}): Promise<FosEmployeePermission[]>;
/**
 * Grant permission to employee.
 * POST /api/pos/fos/permissions/employee-permissions/
 */
export declare function grantEmployeePermission(data: {
    employee: number;
    permission: number;
    is_active?: boolean;
    expires_at?: string | null;
    notes?: string;
}): Promise<FosEmployeePermission>;
/**
 * Revoke employee permission.
 * DELETE /api/pos/fos/permissions/employee-permissions/<id>/
 */
export declare function revokeEmployeePermission(id: number): Promise<void>;
/**
 * The real staff roster + the FOS role each person holds. Drives the Access
 * Control screen's role assignment.
 *
 * Not to be confused with `getEmployees()` (/fos/hr/employees/), which still
 * returns hardcoded mock people and must never be used to grant authority.
 *
 * GET /api/pos/fos/permissions/employees/
 */
export declare function getPermissionEmployees(): Promise<FosPermissionEmployee[]>;
/**
 * List employee roles.
 * GET /api/pos/fos/permissions/employee-roles/
 */
export declare function getEmployeeRoles(params?: {
    employee_id?: string;
}): Promise<FosEmployeeRole[]>;
/**
 * Assign role to employee.
 * POST /api/pos/fos/permissions/employee-roles/
 */
export declare function assignEmployeeRole(data: {
    employee: number;
    role: number;
    is_active?: boolean;
}): Promise<FosEmployeeRole>;
/**
 * Remove employee role.
 * DELETE /api/pos/fos/permissions/employee-roles/<id>/
 */
export declare function removeEmployeeRole(id: number): Promise<void>;
/**
 * Initialize default permissions and roles.
 * POST /api/pos/fos/permissions/initialize/
 */
export declare function initializeFosPermissions(): Promise<{
    success: boolean;
    message: string;
    modules_created: number;
    permissions_created: number;
    roles_created: number;
}>;
/**
 * Get employee permissions summary.
 * GET /api/pos/fos/permissions/employee-summary/<employee_id>/
 */
export declare function getEmployeePermissionsSummary(employeeId: string): Promise<FosEmployeePermissionsSummary>;
/**
 * Get all messages for a ticket.
 * GET /api/pos/fos/support/tickets/<ticket_id>/messages/
 */
export declare function getTicketMessages(ticketId: string): Promise<TicketMessagesResponse>;
/**
 * The Sprout conversation that preceded this ticket — what the customer already
 * explained, and what the AI already told them. Read-only context for the human
 * agent so the customer never has to repeat themselves.
 *
 * `has_transcript: false` (with a `reason`) is a normal answer, not an error: the
 * ticket may have been raised by phone or WhatsApp with no AI chat behind it.
 * Excludes the model's internal reasoning — only turns the customer actually saw.
 *
 * GET /api/pos/fos/support/tickets/<ticket_id>/ai-transcript/
 */
export declare function getTicketAiTranscript(ticketId: string): Promise<AiTranscriptResponse>;
/**
 * Send a message to a ticket.
 * POST /api/pos/fos/support/tickets/<ticket_id>/messages/
 */
export declare function sendTicketMessage(ticketId: string, data: SendTicketMessageRequest): Promise<TicketMessage & {
    ticket_status: string;
    whatsapp_delivered?: boolean | null;
}>;
/**
 * Explicitly resolve/close a ticket.
 * POST /api/pos/fos/support/tickets/<ticket_id>/resolve/
 */
export declare function resolveTicket(ticketId: string): Promise<{
    id: string;
    status: string;
    resolved_at: string;
}>;
export interface DeliveryCashDrop {
    id: string;
    amount: string;
    status: 'PENDING' | 'ACKNOWLEDGED' | 'REJECTED' | 'EXPIRED';
    partner_name?: string;
    acknowledged_by: string | null;
    acknowledged_at: string | null;
    created_at: string;
    expires_at: string | null;
    note: string;
}
/** FOS: list all pending delivery partner cash drop requests. */
export declare function listDeliveryCashDrops(): Promise<DeliveryCashDrop[]>;
/** FOS: acknowledge a delivery partner cash drop (credit received). */
export declare function acknowledgeDeliveryCashDrop(dropId: string, note?: string): Promise<DeliveryCashDrop>;
export type KycDocStatus = "pending" | "verified" | "rejected";
export type KycOverallStatus = "incomplete" | "in_review" | "verified" | "rejected";
export interface KycSummary {
    required_count: number;
    uploaded_count: number;
    verified_count: number;
    rejected_count: number;
    is_complete: boolean;
    all_verified: boolean;
    overall_status: KycOverallStatus;
}
export interface KycPartner {
    user_id: number;
    name: string;
    phone: string;
    vehicle_type: string;
    vehicle_number: string;
    city: string;
    kyc: KycSummary;
}
export interface KycDocument {
    id: string;
    doc_type: string;
    doc_type_display: string;
    doc_number: string;
    file_url: string | null;
    status: KycDocStatus;
    status_display: string;
    uploaded_at: string;
    verified_at: string | null;
    /** Full name of the FOS/admin user who reviewed it. */
    verified_by: string | null;
    rejection_reason: string;
}
export interface KycPartnerDetail {
    partner: KycPartner;
    profile: Record<string, unknown> | null;
    documents: KycDocument[];
    kyc: KycSummary;
}
export interface KycReviewResponse {
    message: string;
    documents: KycDocument[];
    kyc: KycSummary;
}
/**
 * FOS: KYC review queue — delivery partners who have started KYC.
 * GET /api/delivery-partner/fos/kyc/partners/?status=
 */
export declare function listKycPartners(status?: KycOverallStatus): Promise<KycPartner[]>;
/**
 * FOS: one partner's profile + documents for review.
 * GET /api/delivery-partner/fos/kyc/partners/<userId>/
 */
export declare function getKycPartner(userId: number): Promise<KycPartnerDetail>;
/**
 * FOS: verify or reject a single KYC document (records the reviewer).
 * POST /api/delivery-partner/fos/kyc/documents/<docId>/review/
 */
export declare function reviewKycDocument(docId: string, action: "verify" | "reject", rejectionReason?: string): Promise<KycReviewResponse>;
export type WithdrawalStatus = "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";
export interface DeliveryWithdrawal {
    id: string;
    amount: string;
    method: "UPI" | "BANK";
    status: WithdrawalStatus;
    reference: string;
    note: string;
    upi_id: string;
    bank_account_name: string;
    bank_account_number: string;
    bank_ifsc: string;
    processed_by: string | null;
    requested_at: string;
    processed_at: string | null;
    partner_id?: number;
    partner_name?: string;
    partner_phone?: string;
}
/**
 * FOS: list delivery-partner withdrawal requests (default pending).
 * GET /api/delivery-partner/fos/withdrawals/?status=
 */
export declare function listWithdrawals(status?: WithdrawalStatus | "all"): Promise<DeliveryWithdrawal[]>;
/**
 * FOS: mark a withdrawal PAID (with reference) or REJECTED (refunds the rider).
 * POST /api/delivery-partner/fos/withdrawals/<id>/process/
 */
export declare function processWithdrawal(id: string, action: "pay" | "reject", opts?: {
    reference?: string;
    note?: string;
}): Promise<DeliveryWithdrawal>;
/** One page of results — the envelope every paginated FOS list returns. */
export interface FosPage<T> {
    results: T[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
}
export interface PrideMember {
    id: number;
    user_id: number;
    name: string;
    username: string;
    phone: string;
    email: string;
    tier_code: string | null;
    tier_name: string;
    invested_amount: number;
    monthly_credit_pct: number;
    annual_loyalty_pct: number;
    total_savings: number;
    wallet_balance: number;
    accumulated_pride_limit: number;
    refund_requested: boolean;
    refund_approved: boolean;
    start_date: string;
    member_days: number;
}
export interface PrideReferral {
    id: number;
    referrer_name: string;
    referrer_username: string;
    referee_name: string;
    referee_username: string;
    referral_code: string;
    bonus_amount: number;
    status: "PENDING" | "COMPLETED" | "CREDITED" | "FAILED";
    status_display: string;
    created_at: string;
    bonus_credited_date: string | null;
}
export interface PrideRefundRow {
    id: number;
    user_id: number;
    name: string;
    username: string;
    phone: string;
    tier_name: string;
    invested_amount: number;
    wallet_balance: number;
    start_date: string;
    requested_days_ago: number;
    member_days: number;
}
export interface PrideTierBreakdown {
    tier_code: string | null;
    tier_name: string;
    members: number;
    invested: number;
}
export interface PrideSummary {
    total_members: number;
    active_members: number;
    refund_requested_count: number;
    total_invested: number;
    total_savings_paid: number;
    pending_refund_amount: number;
    tiers: PrideTierBreakdown[];
    referrals: {
        total: number;
        credited: number;
        pending: number;
        total_bonus_paid: number;
    };
}
/**
 * PRIDE program-health aggregates.
 * GET /api/pos/fos/pride/summary/
 */
export declare function getPrideSummary(): Promise<PrideSummary>;
/**
 * All PRIDE members (paginated). Open/highest-invested surface first.
 * GET /api/pos/fos/pride/members/?page=&page_size=&search=&tier=&status=
 */
export declare function getPrideMembers(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    tier?: string;
    status?: "active" | "refund_requested";
}): Promise<FosPage<PrideMember>>;
/**
 * All referrals across the program (paginated).
 * GET /api/pos/fos/pride/referrals/?page=&page_size=&status=&search=
 */
export declare function getPrideReferrals(params?: {
    page?: number;
    page_size?: number;
    status?: PrideReferral["status"] | "All";
    search?: string;
}): Promise<FosPage<PrideReferral>>;
/**
 * Outstanding partnership-refund requests (oldest first).
 * GET /api/pos/fos/pride/refunds/?page=&page_size=
 */
export declare function getPrideRefundQueue(params?: {
    page?: number;
    page_size?: number;
}): Promise<FosPage<PrideRefundRow>>;
/**
 * Approve (authorize 100% principal return) or reject a refund request.
 * POST /api/pos/fos/pride/refunds/<id>/decide/
 */
export declare function decidePrideRefund(id: number, action: "approve" | "reject", note?: string): Promise<{
    status: "success";
    message: string;
    member: PrideMember;
}>;
export interface SourcingSummary {
    farmers: {
        total: number;
        total_payable: number;
    };
    suppliers: {
        total: number;
        pending_approval: number;
        active: number;
        suspended: number;
        total_payable: number;
    };
    pending_payouts: {
        count: number;
        amount: number;
    };
    kyc_unverified_docs: number;
    draft_invoices: number;
    consignments_inbound: number;
}
export interface SourcingFarmer {
    id: number;
    user_id: number;
    name: string;
    username: string;
    phone: string;
    farm_name: string;
    location: string;
    speciality: string;
    rating: number;
    settlement_model: "OUTRIGHT" | "SALE_OR_RETURN";
    ledger_balance: number;
    pending_payout: number;
    bank_verified: boolean;
    is_visible: boolean;
}
export interface SourcingSupplier {
    id: string;
    name: string;
    legal_name: string;
    /** What they mainly supply, e.g. "Leafy greens & herbs". "" when unset. */
    speciality: string;
    gstin: string;
    status: "PENDING" | "ACTIVE" | "SUSPENDED";
    status_display: string;
    settlement_model: "OUTRIGHT" | "SALE_OR_RETURN";
    payment_terms_days: number;
    agreement_signed: boolean;
    organic_cert_body: string;
    organic_cert_expiry: string | null;
    contact_phone: string;
    contact_email: string;
    city: string;
    state: string;
    ledger_balance: number;
    docs_total: number;
    docs_unverified: number;
    created_at: string;
}
export interface SourcingPayout {
    id: string;
    farmer_id: number;
    farmer_name: string;
    phone: string;
    amount: number;
    status: "pending" | "processing" | "completed" | "failed";
    transaction_ref: string;
    notes: string;
    created_at: string;
    completed_at: string | null;
}
export interface SourcingDocument {
    id: number;
    supplier_id: string;
    supplier_name: string;
    doc_type: "GST" | "FSSAI" | "ORGANIC_CERT" | "AGREEMENT" | "OTHER";
    doc_type_display: string;
    file: string | null;
    expiry_date: string | null;
    is_verified: boolean;
    uploaded_at: string;
}
export interface SourcingConsignment {
    id: string;
    consignment_number: string;
    supplier_id: string;
    supplier_name: string;
    status: "DRAFT" | "SUBMITTED" | "RECEIVING" | "RECEIVED" | "CANCELLED";
    status_display: string;
    expected_date: string | null;
    declared_total_value: number | null;
    item_count: number;
    grn_number: string | null;
    grn_finalized: boolean;
    created_at: string;
}
export interface SourcingInvoice {
    id: string;
    invoice_number: string;
    supplier_id: string;
    supplier_name: string;
    period_start: string;
    period_end: string;
    gross_amount: number;
    deductions_amount: number;
    gst_amount: number;
    net_amount: number;
    status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
    status_display: string;
    paid_at: string | null;
    transaction_ref: string;
    created_at: string;
}
export interface SourcingLedgerEntry {
    id: string;
    entry_type: string;
    entry_type_display: string;
    amount: number;
    balance_after: number;
    notes: string;
    created_at: string;
}
export interface FarmerLedger {
    farmer_id: number;
    farmer_name: string;
    balance: number;
    entries: SourcingLedgerEntry[];
}
export interface SupplierLedger {
    supplier_id: string;
    supplier_name: string;
    balance: number;
    entries: SourcingLedgerEntry[];
}
/** Supply-side health aggregates. GET /api/pos/fos/sourcing/summary/ */
export declare function getSourcingSummary(): Promise<SourcingSummary>;
/** Farmer roster. GET /api/pos/fos/sourcing/farmers/?page=&page_size=&search= */
export declare function getSourcingFarmers(params?: {
    page?: number;
    page_size?: number;
    search?: string;
}): Promise<FosPage<SourcingFarmer>>;
export interface SourcingFarmerBankDetail {
    account_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    upi_id: string;
    is_verified: boolean;
    approval_status: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
}
export interface SourcingFarmerDetail extends SourcingFarmer {
    email: string;
    bio: string;
    image: string | null;
    years_of_experience: number;
    total_acreage: number | null;
    crops: string[];
    verification_status: "INCOMPLETE" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
    verification_status_display: string;
    partnership_type: "STANDARD" | "PRICE_PARTNER";
    partnership_type_display: string;
    farmer_revenue_share: number;
    organic_pledge_accepted: boolean;
    submitted_at: string | null;
    bank_details: SourcingFarmerBankDetail | null;
}
/** One farmer's full profile for the detail drawer. GET /api/pos/fos/sourcing/farmers/{id}/ */
export declare function getSourcingFarmerDetail(id: number): Promise<SourcingFarmerDetail>;
export interface CreateSourcingFarmerInput {
    name: string;
    phone: string;
    farm_name?: string;
    location?: string;
    speciality?: string;
    settlement_model?: SourcingFarmer["settlement_model"];
}
/** Onboard a farmer directly from FOS (auto-approved). POST .../farmers/create/ */
export declare function createSourcingFarmer(body: CreateSourcingFarmerInput): Promise<{
    status: "success";
    message: string;
    farmer: SourcingFarmer;
}>;
/** One farmer's running account. GET /api/pos/fos/sourcing/farmers/{id}/ledger/ */
export declare function getFarmerLedger(id: number): Promise<FarmerLedger>;
/** Farmer-payout queue. GET /api/pos/fos/sourcing/payouts/?status=&page=&page_size= */
export declare function getSourcingPayouts(params?: {
    page?: number;
    page_size?: number;
    status?: SourcingPayout["status"] | "All";
}): Promise<FosPage<SourcingPayout>>;
/** Approve (pay + post ledger debit) or reject a payout. POST .../payouts/{id}/decide/ */
export declare function decideSourcingPayout(id: string, action: "approve" | "reject", opts?: {
    transaction_ref?: string;
    note?: string;
}): Promise<{
    status: "success";
    message: string;
    payout: SourcingPayout;
}>;
/** Supplier roster. GET /api/pos/fos/sourcing/suppliers/?status=&search=&page=&page_size= */
export declare function getSourcingSuppliers(params?: {
    page?: number;
    page_size?: number;
    status?: SourcingSupplier["status"] | "All";
    search?: string;
}): Promise<FosPage<SourcingSupplier>>;
export interface CreateSourcingSupplierInput {
    name: string;
    legal_name?: string;
    /** What they mainly supply, e.g. "Leafy greens & herbs" (mirrors the farmer's). */
    speciality?: string;
    gstin?: string;
    contact_phone?: string;
    contact_email?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    settlement_model?: SourcingSupplier["settlement_model"];
    payment_terms_days?: number;
    organic_cert_body?: string;
    notes?: string;
}
/** Onboard a supplier directly from FOS (auto-activated). POST .../suppliers/create/ */
export declare function createSourcingSupplier(body: CreateSourcingSupplierInput): Promise<{
    status: "success";
    message: string;
    supplier: SourcingSupplier;
}>;
/** One supplier's running account. GET /api/pos/fos/sourcing/suppliers/{id}/ledger/ */
export declare function getSupplierLedger(id: string): Promise<SupplierLedger>;
/** Approve onboarding / suspend / revert a supplier. POST .../suppliers/{id}/status/ */
export declare function setSupplierStatus(id: string, newStatus: SourcingSupplier["status"]): Promise<{
    status: "success";
    message: string;
    supplier: SourcingSupplier;
}>;
/** Draft a settlement invoice for a period. POST .../suppliers/{id}/invoice/ */
export declare function buildSupplierInvoice(id: string, period_start: string, period_end: string): Promise<{
    status: "success";
    message: string;
    invoice: SourcingInvoice;
}>;
/** Unverified supplier KYC docs. GET /api/pos/fos/sourcing/kyc/?page=&page_size= */
export declare function getKycQueue(params?: {
    page?: number;
    page_size?: number;
}): Promise<FosPage<SourcingDocument>>;
/** Verify / unverify a KYC document. POST /api/pos/fos/sourcing/kyc/{id}/verify/ */
export declare function verifyKycDocument(id: number, verified: boolean): Promise<{
    status: "success";
    message: string;
    document: SourcingDocument;
}>;
/** Inbound consignment + GRN oversight. GET /api/pos/fos/sourcing/consignments/ */
export declare function getSourcingConsignments(params?: {
    page?: number;
    page_size?: number;
    status?: SourcingConsignment["status"] | "All";
    search?: string;
}): Promise<FosPage<SourcingConsignment>>;
/** Settlement invoices. GET /api/pos/fos/sourcing/invoices/?status=&page=&page_size= */
export declare function getSourcingInvoices(params?: {
    page?: number;
    page_size?: number;
    status?: SourcingInvoice["status"] | "All";
}): Promise<FosPage<SourcingInvoice>>;
/** Mark an invoice paid (posts the ledger debit). POST .../invoices/{id}/settle/ */
export declare function settleSupplierInvoice(id: string, transaction_ref?: string): Promise<{
    status: "success";
    message: string;
    invoice: SourcingInvoice;
}>;
export type RecognitionKind = "POSITIVE" | "NUDGE" | "WARNING";
export type RecognitionCategory = "WASTAGE" | "BILLING" | "SALES" | "RELIABILITY" | "CASH" | "MANUAL";
export interface RecognitionSummary {
    recognized_employees: number;
    total_points: number;
    pending_bonus_total: number;
    events_total: number;
    positive_events: number;
    nudges: number;
    warnings: number;
    wastage_warnings: number;
}
export interface RecognitionBadge {
    badge: string;
    reason: string;
    awarded_at: string;
}
export interface RecognitionLeaderRow {
    employee_id: string;
    name: string;
    designation: string;
    points: number;
    badge_count: number;
    badges: RecognitionBadge[];
    pending_bonus: number;
    pending_deduction: number;
    updated_at: string;
}
export interface AppreciationEvent {
    id: number;
    employee_id: string;
    employee_name: string;
    kind: RecognitionKind;
    kind_display: string;
    category: RecognitionCategory;
    category_display: string;
    points: number;
    badge: string;
    bonus_amount: number;
    reason: string;
    triggered_by: "AUTO" | "FOUNDER" | "PEER";
    created_at: string;
}
export type WastageTier = "ZERO" | "CHAMPION" | "WARRIOR" | "NEUTRAL" | "NUDGE" | "WARNING";
export interface WastageScorecard {
    id: number;
    employee_id: string;
    employee_name: string;
    period_start: string;
    period_end: string;
    wastage_cost: number;
    sales: number;
    wastage_pct: number;
    baseline_pct: number;
    tier: WastageTier;
    tier_display: string;
    points_awarded: number;
    created_at: string;
}
/** Recognition program aggregates. GET /api/pos/fos/recognition/summary/ */
export declare function getRecognitionSummary(): Promise<RecognitionSummary>;
/** Cross-staff incentive leaderboard. GET /api/pos/fos/recognition/leaderboard/ */
export declare function getRecognitionLeaderboard(params?: {
    page?: number;
    page_size?: number;
    search?: string;
}): Promise<FosPage<RecognitionLeaderRow>>;
/** Appreciation-event feed. GET /api/pos/fos/recognition/events/ */
export declare function getRecognitionEvents(params?: {
    page?: number;
    page_size?: number;
    kind?: RecognitionKind | "All";
    category?: RecognitionCategory | "All";
    employee_id?: string;
    search?: string;
}): Promise<FosPage<AppreciationEvent>>;
/** Wastage scorecards. GET /api/pos/fos/recognition/wastage/ */
export declare function getRecognitionWastage(params?: {
    page?: number;
    page_size?: number;
    tier?: WastageTier | "All";
    employee_id?: string;
}): Promise<FosPage<WastageScorecard>>;
/** Manually award positive recognition. POST /api/pos/fos/recognition/award/ */
export declare function awardRecognition(body: {
    employee_id: string;
    reason: string;
    points?: number;
    badge?: string;
    bonus_amount?: number;
    category?: RecognitionCategory;
}): Promise<{
    status: "success";
    message: string;
    event: AppreciationEvent;
}>;
/** Manually log a private nudge / warning. POST /api/pos/fos/recognition/flag/ */
export declare function flagRecognition(body: {
    employee_id: string;
    reason: string;
    warning?: boolean;
    category?: RecognitionCategory;
}): Promise<{
    status: "success";
    message: string;
    event: AppreciationEvent;
}>;
export interface CatalogCategory {
    id: number;
    name: string;
    slug: string;
    description: string;
    emoji: string | null;
    banner: string | null;
    product_count: number;
    subcategory_count: number;
}
export interface CatalogSubCategory {
    id: number;
    name: string;
    slug: string;
    category_id: number;
    category_name: string;
    emoji: string | null;
    product_count: number;
}
export interface CatalogVariant {
    id: number;
    product_id: number;
    unit: string;
    sku: string;
    price: number;
    mrp: number | null;
    gst_rate: number;
    is_gst_inclusive: boolean;
    is_active: boolean;
    weight_grams: number | null;
    weight_per_piece_grams: number | null;
    /** Sold loose, priced per kg, weighed at the counter — drives whether POS
     * quantity entry (and the Essae scale) treats this as kg or as pieces. */
    weighed: boolean;
    batch_count: number;
}
/** A gallery image attached to a product, ordered by `order` (0 = first). */
export interface CatalogProductImage {
    id: number;
    image: string | null;
    alt_text: string;
    order: number;
}
export interface CatalogProduct {
    id: number;
    name: string;
    description: string;
    storage_instructions: string;
    hsn_code: string;
    category_id: number;
    category_name: string;
    subcategory_id: number | null;
    subcategory_name: string | null;
    is_perishable: boolean;
    shared_stock: boolean;
    low_stock_threshold: number;
    moisture_loss_tolerance_pct: number;
    /** Max km from the nearest hub we deliver this to. null = no limit. */
    delivery_radius_km: number | null;
    base_image: string | null;
    card_image: string | null;
    images?: CatalogProductImage[];
    water_score: number;
    soil_score: number;
    chemical_score: number;
    farmer_score: number;
    variant_count: number;
    created_at: string;
    variants?: CatalogVariant[];
}
export declare function getCatalogCategories(params?: {
    page?: number;
    page_size?: number;
    search?: string;
}): Promise<FosPage<CatalogCategory>>;
export declare function createCatalogCategory(body: {
    name: string;
    description?: string;
    slug?: string;
}): Promise<CatalogCategory>;
export declare function updateCatalogCategory(id: number, body: Partial<{
    name: string;
    description: string;
    slug: string;
}>): Promise<CatalogCategory>;
export declare function deleteCatalogCategory(id: number): Promise<void>;
export declare function getCatalogSubCategories(params?: {
    page?: number;
    page_size?: number;
    category?: number;
}): Promise<FosPage<CatalogSubCategory>>;
export declare function createCatalogSubCategory(body: {
    name: string;
    category_id: number;
    slug?: string;
}): Promise<CatalogSubCategory>;
export declare function updateCatalogSubCategory(id: number, body: Partial<{
    name: string;
    category_id: number;
    slug: string;
}>): Promise<CatalogSubCategory>;
export declare function deleteCatalogSubCategory(id: number): Promise<void>;
export interface CatalogProductInput {
    name?: string;
    description?: string;
    storage_instructions?: string;
    hsn_code?: string;
    category_id?: number;
    subcategory_id?: number | null;
    is_perishable?: boolean;
    shared_stock?: boolean;
    low_stock_threshold?: number;
    moisture_loss_tolerance_pct?: number;
    /** Max km from the nearest hub. Send null to clear the cap (deliver anywhere). */
    delivery_radius_km?: number | null;
    water_score?: number;
    soil_score?: number;
    chemical_score?: number;
    farmer_score?: number;
}
export declare function getCatalogProducts(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    category?: number;
}): Promise<FosPage<CatalogProduct>>;
export declare function getCatalogProduct(id: number): Promise<CatalogProduct>;
export declare function createCatalogProduct(body: CatalogProductInput): Promise<CatalogProduct>;
export declare function updateCatalogProduct(id: number, body: CatalogProductInput): Promise<CatalogProduct>;
export declare function deleteCatalogProduct(id: number): Promise<void>;
/** Replace the product's primary image (`base_image`). Returns the updated product. */
export declare function uploadCatalogProductBaseImage(id: number, file: File): Promise<CatalogProduct>;
/** Add a gallery image (appended after the current last). */
export declare function addCatalogProductImage(productId: number, file: File, altText?: string): Promise<CatalogProductImage>;
/** Delete one gallery image. */
export declare function deleteCatalogProductImage(productId: number, imageId: number): Promise<void>;
/** Reorder the gallery — pass the image ids in the desired order. Returns the new list. */
export declare function reorderCatalogProductImages(productId: number, orderedIds: number[]): Promise<CatalogProductImage[]>;
export type UnitMeasure = "WEIGHT" | "VOLUME" | "COUNT";
export interface CatalogUnit {
    id: number;
    label: string;
    measure: UnitMeasure;
    sort_order: number;
}
/** Active units for the variant unit dropdown. */
export declare function getCatalogUnits(): Promise<CatalogUnit[]>;
/** Add a custom unit to the catalog (de-duped case-insensitively). */
export declare function createCatalogUnit(body: {
    label: string;
    measure?: UnitMeasure;
}): Promise<CatalogUnit>;
export interface CatalogVariantInput {
    unit?: string;
    price?: number;
    mrp?: number;
    gst_rate?: number;
    is_gst_inclusive?: boolean;
    is_active?: boolean;
    weight_grams?: number;
    weight_per_piece_grams?: number;
    weighed?: boolean;
}
export declare function getCatalogVariants(params?: {
    product?: number;
    page?: number;
    page_size?: number;
}): Promise<FosPage<CatalogVariant>>;
export declare function createCatalogVariant(body: CatalogVariantInput & {
    product_id: number;
}): Promise<CatalogVariant>;
export declare function updateCatalogVariant(id: number, body: CatalogVariantInput): Promise<CatalogVariant>;
export declare function deleteCatalogVariant(id: number): Promise<void>;
//# sourceMappingURL=fos.d.ts.map