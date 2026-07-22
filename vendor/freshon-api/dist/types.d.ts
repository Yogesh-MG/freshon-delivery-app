export type UserRole = "ADMIN" | "CUSTOMER" | "FARMER" | "DELIVERY" | "PICKER" | "POS_OPERATOR";
export interface CurrentUser {
    id: number;
    username: string;
    email: string;
    /** Primary / display role. */
    role: UserRole;
    /** All roles held (primary + secondary) for multi-capability accounts. */
    roles?: string[];
    is_verified: boolean;
    first_name?: string;
    last_name?: string;
    partnership?: PartnershipInfo;
    remaining_pride_limit?: string;
}
export interface PartnershipInfo {
    tier: PartnershipTier;
    tier_display: string;
    invested_amount: number;
    start_date: string;
    total_savings: number;
}
export interface LoginRequest {
    username: string;
    password: string;
}
export interface LoginResponse {
    message: string;
    user: {
        id: number;
        username: string;
        email: string;
        role: UserRole;
    };
    access: string;
    refresh: string;
}
export interface RegisterRequest {
    username: string;
    email?: string;
    password: string;
}
export interface RegisterResponse {
    message: string;
    user: {
        id: number;
        username: string;
        email: string;
    };
}
export interface TokenRefreshRequest {
    refresh: string;
}
export interface TokenRefreshResponse {
    message: string;
    access: string;
    refresh: string;
}
export interface Category {
    id: number;
    name: string;
    slug: string;
    emoji: string;
    subcategory_count: number;
    product_count: number;
}
export interface CategoryDetail extends Category {
    subcategories: Subcategory[];
}
export interface Subcategory {
    id: number;
    name: string;
    slug: string;
}
export interface InventoryBatch {
    id: string;
    product_id: string;
    product_name: string;
    price: string;
    mrp: string | null;
    stock_level: number;
    harvest_date: string;
    harvest_date_display: string | null;
    is_organic: boolean;
    is_farm_fresh: boolean;
    is_perishable: boolean;
    base_image: string | null;
    batch_image: string | null;
    category_name: string;
    category_slug: string;
    farmer_id: number;
    farmer_name: string;
    variant?: {
        unit: string;
    };
    /** Max km from the nearest hub this product is delivered within. null = no limit. */
    delivery_radius_km?: number | null;
    /** False when the above radius doesn't reach the requesting shopper's coordinates. */
    is_deliverable?: boolean;
    /**
     * Where this batch physically sits (picker.Hub id). Staff-only — null for
     * anonymous shoppers, since the catalog endpoint is public and must not leak
     * internal facility names.
     */
    facility?: string | null;
    facility_name?: string | null;
    /**
     * OUTLET = at a hub (packable). WAREHOUSE = still central stock, must be
     * transferred to the hub before it can be packed/printed.
     */
    facility_type?: FacilityType | null;
}
export type FacilityType = "OUTLET" | "WAREHOUSE" | "MILL" | "COLD_STORAGE" | "PACKHOUSE" | "OTHER";
/** A hub/facility — a node in the supply chain (warehouse, outlet, mill, …). */
export interface Facility {
    id: string;
    name: string;
    facility_type: FacilityType;
}
/**
 * An instruction to move raw material between facilities (warehouse → hub).
 * Raised from FOS (origin MANUAL) or by the ops agent (origin AI); a warehouse
 * employee fulfils it in Fpick by dispatching stock against it. `quantity` is
 * in GRAMS, like all stock.
 */
export interface TransferRequest {
    id: string;
    product: number;
    product_name: string;
    variant: number | null;
    variant_unit: string;
    /** Grams requested. */
    quantity: string;
    /** Grams dispatched so far. */
    dispatched_quantity: string;
    remaining_quantity: string;
    source_facility: string | null;
    source_facility_name: string;
    destination_facility: string;
    destination_facility_name: string;
    status: "PENDING" | "IN_PROGRESS" | "FULFILLED" | "CANCELLED";
    status_display: string;
    origin: "AI" | "MANUAL";
    reason: string;
    created_by: number | null;
    fulfilled_by: number | null;
    created_at: string;
    updated_at: string;
    fulfilled_at: string | null;
}
export interface PackingPlanSummary {
    batch: string;
    planned_packets: number;
    committed_packets: number;
    remaining_packets: number;
    reserved_packets: number;
    available_packets: number;
    weight_grams_per_packet: number;
    decided_by_agent: boolean;
    notes: string;
}
/** Returned by GET .../packing-plan/?variant_id=X when that variant differs
 * from the batch's own native variant — PackingPlan doesn't apply there
 * (it's sized off the batch's own variant weight), so availability is
 * computed directly from the raw batch's remaining/reserved grams instead. */
export interface CrossVariantAvailability {
    batch: string;
    output_variant: number;
    output_variant_unit: string;
    weight_grams_per_packet: number;
    raw_stock_level_grams: number;
    reserved_raw_grams: number;
    available_grams: number;
    available_packets: number;
}
export interface ClaimPacketsResult {
    barcodes: string[];
    assignment_status: string | null;
    planned_packets?: number;
    committed_packets?: number;
    remaining_packets?: number;
    reserved_packets?: number;
    available_packets?: number;
    output_variant_id?: number;
    output_variant_unit?: string;
    raw_stock_level_grams?: number;
    reserved_raw_grams?: number;
    available_raw_grams?: number;
}
export type IngestionAssignmentStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export interface IngestionAssignment {
    id: string;
    batch: string;
    /** Target retail size, when different from the raw batch's own variant
     * (cross-variant assignment). Null for legacy same-variant assignments. */
    output_variant: number | null;
    product_name: string;
    variant_unit: string;
    assigned_to: {
        id: number;
        name: string;
    } | null;
    assigned_by: {
        id: number;
        name: string;
    } | null;
    packet_count: number;
    fulfilled_count: number;
    status: IngestionAssignmentStatus;
    created_at: string;
    completed_at: string | null;
}
export interface FarmerProfile {
    id: number;
    user_id: number;
    name: string;
    location: string;
    years_of_experience: number;
    rating: number;
    speciality: string;
    bio: string;
    image: string | null;
    fcm_token?: string;
    fcm_token_updated_at?: string;
}
export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type PaymentMethod = "WALLET" | "WALLET_CARD" | "WALLET_UPI" | "UPI" | "CARD" | "COD";
export type PaymentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
export type DeliverySlotType = "EXPRESS" | "SAME_DAY" | "NEXT_DAY" | "TAKE_AWAY";
export interface PlaceOrderRequest {
    address_title: string;
    address_line: string;
    delivery_slot: DeliverySlotType;
    payment_method: PaymentMethod;
    items: Array<{
        batch: string;
        quantity: number;
    }>;
    remark?: string;
}
export interface PlaceOrderResponse {
    tracking_id: string;
    subtotal: number;
    delivery_fee: number;
    total: number;
    status: OrderStatus;
}
/** How the order was placed: ONLINE (consumer app) or POS (in-store walk-in). */
export type OrderType = "ONLINE" | "POS";
export interface Order {
    tracking_id: string;
    user: number;
    address_title: string;
    address_line: string;
    delivery_slot: DeliverySlotType;
    delivery_fee: string;
    payment_method: PaymentMethod;
    payment_status: PaymentStatus;
    wallet_amount_used: string;
    remaining_amount: string;
    is_paid: boolean;
    subtotal: string;
    total: string;
    member_discount: string;
    pride_limit_used: string;
    status: OrderStatus;
    /** ONLINE for app orders, POS for in-store purchases. Both belong to the user's bills. */
    order_type?: OrderType;
    items: OrderItem[];
    /** 'local' = in-house rider, 'courier' = third-party (out-of-radius). */
    delivery_mode?: DeliveryMode;
    /** Raw assignment lifecycle status (drives the local delivery stepper); null until assigned. */
    delivery_status?: DeliveryAssignmentStatus | null;
    /** Real driver/courier from order.delivery_assignment; null until assigned. */
    delivery_partner?: DeliveryPartner | null;
    /** Mode-aware ETA: { mode, display }. Replaces the old fake eta_minutes. */
    eta?: DeliveryEta | null;
    created_at: string;
    updated_at: string;
    remark?: string;
}
export type DeliveryMode = "local" | "courier";
/** DeliveryAssignment.status — local lifecycle + third-party courier lifecycle. */
export type DeliveryAssignmentStatus = "PENDING" | "ACCEPTED" | "PICKED_UP" | "IN_TRANSIT" | "AWAITING_BOOKING" | "BOOKING_FAILED" | "COURIER_ASSIGNED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
/** In-house rider, read from assignment.partner.employee_profile (or external driver on handoff). */
export interface DeliveryPartnerLocal {
    mode: "local";
    name: string;
    phone: string | null;
    vehicle: string | null;
    vehicle_number?: string | null;
    /** Live straight-line distance from the rider to the customer, e.g. "1.2 km". */
    distance_away: string | null;
}
/** Third-party courier, read from the courier fields on the assignment. */
export interface DeliveryPartnerCourier {
    mode: "courier";
    /** Human courier brand, e.g. "Delhivery". */
    courier_partner: string | null;
    /** Raw courier code, e.g. "DELHIVERY" — used to build the track-on deep link. */
    courier_code: string | null;
    waybill_number: string | null;
    tracking_status_description: string | null;
    /** ISO datetime. */
    estimated_delivery_date: string | null;
}
export type DeliveryPartner = DeliveryPartnerLocal | DeliveryPartnerCourier;
/** Mode-aware ETA. Local → "12:45 PM", courier → "Tue, 28 Jun"; display null when unknown. */
export interface DeliveryEta {
    mode: DeliveryMode;
    display: string | null;
}
export interface OrderItem {
    id: number;
    batch: string | null;
    product_name: string;
    price: string;
    quantity: number;
    unit: string;
    /** Line total (price * quantity), returned by the backend detail serializer. */
    total?: number;
    /** GST % for the line (inferred from category), returned by the detail serializer. */
    gst_rate?: number;
}
export type AddressType = "HOME" | "WORK" | "OTHER";
export interface DeliverySlot {
    id: string;
    title: string;
    description: string;
    slot_type: DeliverySlotType;
    delivery_fee: string;
    available: boolean;
}
export interface DeliveryAddress {
    id: number;
    user: number;
    address_type: AddressType;
    title: string;
    address_line: string;
    latitude: number | null;
    longitude: number | null;
    is_default: boolean;
}
export interface SaveAddressRequest {
    address_type: AddressType;
    title: string;
    address_line: string;
    latitude?: number;
    longitude?: number;
    is_default?: boolean;
}
export interface LocationValidationRequest {
    latitude: number;
    longitude: number;
    address: string;
}
export interface LocationValidationResponse {
    valid: boolean;
    message: string;
    service_area?: string;
    distance_km?: number;
    out_of_radius?: boolean;
}
export interface CheckoutConfig {
    cod_enabled: boolean;
    free_delivery_threshold: string;
    out_of_radius_free_delivery_threshold?: string;
    out_of_radius_label?: string;
    minimum_delivery_fee?: string;
    customer_free_km?: string;
    small_cart_threshold?: string;
    small_cart_fee?: string;
    customer_surge_multiplier?: string;
    rider_base_pay?: string;
    rider_per_km_pay?: string;
    rider_free_km?: string;
    rider_long_distance_km?: string;
    rider_long_distance_bonus?: string;
    rider_min_earning?: string;
    rider_peak_multiplier?: string;
    updated_at: string;
}
export type ICICIPaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED" | "ERROR";
/** Response from the ICICI PG generateQR API (native upi://pay QR). */
export interface ICICIGenerateQRResponse {
    success: boolean;
    /** upi://pay?... payload — render as a QR; any UPI app scans it. */
    upi_qr: string | null;
    /** BharatQR payload, if the bank returned one (usually null for UPI). */
    bharat_qr: string | null;
    /** Unique merchantRefNo; poll status with this (== merchant_txn_no). */
    merchant_ref_no: string;
    merchant_txn_no: string;
    /** Human-readable QR expiry (e.g. "22/04/2026 12:58:30"). */
    expiry: string | null;
    /** Set when generated against an existing order. */
    order_id: string | null;
    error?: string;
}
export interface RazorpayInitRequest {
    items: Array<{
        batch: string;
        quantity: number;
    }>;
    wallet_amount_used?: number;
    delivery_slot?: string;
    latitude?: number | null;
    longitude?: number | null;
    /** The pre-created (unpaid) FreshOn order this payment settles. When set, the
     *  server binds razorpay_order_id -> order so the webhook can settle it even if
     *  the browser never returns after paying (routine on mobile UPI). */
    freshon_order_id?: string;
}
export interface RazorpayInitResponse {
    razorpay_order_id: string;
    key_id: string;
    amount: number;
    currency: string;
}
export interface RazorpayVerifyRequest {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
    /** The FreshOn order to settle (it already exists, created unpaid at checkout). */
    freshon_order_id?: string;
}
export type WalletTier = "STANDARD" | "PRIDE_1" | "PRIDE_2" | "PRIDE_3";
export type WalletTransactionReason = "TOPUP" | "ORDER_PAYMENT" | "ORDER_REFUND" | "MONTHLY_CREDIT" | "LOYALTY_BONUS" | "REFERRAL_BONUS";
export type PartnershipTier = "TIER_1" | "TIER_2" | "TIER_3";
export interface Wallet {
    id: number;
    balance: string;
    tier: WalletTier;
    accumulated_pride_limit: string;
    created_at: string;
    updated_at: string;
}
export interface WalletDetail extends Wallet {
    transactions: WalletTransaction[];
    partnership: Partnership | null;
    accumulated_pride_limit: string;
}
export interface WalletTransaction {
    id: number;
    amount: string;
    reason: WalletTransactionReason;
    balance_before: string;
    balance_after: string;
    related_order: string | null;
    created_at: string;
}
export interface WalletTopup {
    id: number;
    amount: string;
    razorpay_order_id: string;
    razorpay_payment_id: string | null;
    status: "INITIATED" | "PENDING" | "SUCCESS" | "FAILED";
    created_at: string;
}
export interface TopupInitRequest {
    amount: number;
}
export interface TopupInitResponse {
    topup_id: number;
    razorpay_order_id: string;
    amount: number;
    key_id: string;
}
export interface TopupVerifyRequest {
    topup_id: number;
    razorpay_payment_id: string;
    razorpay_signature: string;
}
export interface Partnership {
    id: number;
    user: number;
    tier: PartnershipTier;
    invested_amount: string;
    monthly_credit_percentage: string;
    annual_loyalty_percentage: string;
    refund_requested: boolean;
    start_date: string;
}
export interface Referral {
    id: number;
    referrer: number;
    referee: number;
    referral_code: string;
    bonus_amount: string;
    status: "PENDING" | "COMPLETED" | "CREDITED" | "FAILED";
    first_order: string | null;
    bonus_credited_date: string | null;
}
export interface ReferralCodeResponse {
    referral_code: string;
    share_link: string;
}
export interface CustomerPreferences {
    organic_only: boolean;
    vegetarian: boolean;
    avoid_plastic: boolean;
    allergens: string;
    notes: string;
}
export interface CustomerSettings {
    order_updates: boolean;
    offers: boolean;
    weekly_summary: boolean;
    private_profile: boolean;
}
export interface CustomerProfileData {
    address: DeliveryAddress | null;
    preferences: CustomerPreferences;
    settings: CustomerSettings;
}
export interface UpdateProfileRequest {
    address?: Partial<SaveAddressRequest>;
    preferences?: Partial<CustomerPreferences>;
    settings?: Partial<CustomerSettings>;
}
export type PickItemStatus = "pending" | "scanning" | "packed" | "issue" | "substituted";
export type PickerOrderStatus = "queued" | "in_progress" | "qa" | "ready";
export type PickerOrderPriority = "urgent" | "high" | "normal";
export interface PickerSubstitution {
    name: string;
    sku: string;
    reason: string;
}
export interface PickItem {
    id: string;
    name: string;
    sku: string;
    batch: string;
    quantity: number;
    unit: string;
    location: string;
    emoji: string;
    status: PickItemStatus;
    substitutions: PickerSubstitution[];
}
export interface PickerOrder {
    id: string;
    customer: string;
    deadline_minutes: number;
    item_count: number;
    priority: PickerOrderPriority;
    items: PickItem[];
    status: PickerOrderStatus;
}
export interface PickerGeoVerifyRequest {
    latitude: number;
    longitude: number;
}
export interface PickerGeoVerifyResponse {
    verified: boolean;
    message: string;
    hub_name?: string;
}
export interface PickerScanRequest {
    item_id: string;
    barcode: string;
}
export type DeliveryServiceType = "swift" | "next-day" | "standard";
export type MissionStopType = "pickup" | "dropoff";
export interface MissionStopItem {
    name: string;
    qty: number;
    weight: string;
    fragile?: boolean;
}
export interface MissionStop {
    id: string;
    type: MissionStopType;
    label: string;
    address: string;
    customer?: string;
    eta: string;
    items?: MissionStopItem[];
    notes?: string;
}
export interface DeliveryMission {
    id: string;
    service: DeliveryServiceType;
    earnings: number;
    distance_km: number;
    weight_kg: number;
    stops: MissionStop[];
    fee: {
        weight: number;
        distance: number;
        premium: number;
    };
}
export interface DeliveryPartnerStats {
    earnings: number;
    goal: number;
    deliveries: number;
    distance: number;
    rating: number;
}
export interface ProofOfDeliveryRequest {
    mission_id: string;
    stop_id: string;
    type: "otp" | "photo";
    otp_code?: string;
    photo_data?: string;
}
export interface DeliveryPartnerStatusRequest {
    online: boolean;
    latitude: number;
    longitude: number;
}
export interface FarmerRegistrationRequest {
    phone: string;
    otp?: string;
    name?: string;
}
export interface FarmerProfileUpdate {
    name?: string;
    location?: string;
    latitude?: number;
    longitude?: number;
    total_acreage?: number;
    speciality?: string;
    bio?: string;
    fcm_token?: string;
    verification_status?: "INCOMPLETE" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
    submitted_at?: string | null;
    reviewed_at?: string | null;
    rejection_reason?: string;
    section_completion?: Record<"farm_details" | "organic_certification" | "bank", boolean>;
    missing_sections?: string[];
    is_onboarding_complete?: boolean;
    partnership_type?: "STANDARD" | "PRICE_PARTNER";
    farmer_revenue_share?: string;
}
export interface FarmerPurchaseOrder {
    id: string;
    po_number: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "RECEIVED";
    quantity: string;
    purchase_price: string | null;
    selling_price: string | null;
    mrp: string | null;
    unit_basis?: string;
    unit_rate?: string | null;
    num_units?: string | null;
    po_date?: string | null;
    valid_until?: string | null;
    product_name: string;
    created_at: string;
    approved_at?: string | null;
}
export interface FarmerMediaUpload {
    type: "farm_video" | "product_video" | "profile_photo";
    file: File | Blob;
}
export interface FarmerBatch {
    id: string;
    product_id: string;
    product_name: string;
    price: string;
    mrp: string | null;
    stock_level: number;
    harvest_date: string;
    is_organic: boolean;
    status: "Live" | "Pending Review" | "Out of Stock";
}
export interface FarmerAddBatchRequest {
    product_id: string;
    price: number;
    mrp?: number;
    stock_level: number;
    harvest_date: string;
    is_organic: boolean;
    /** Price-partner toggle: farmer fixes the price (51/49 split). PRICE_PARTNER only. */
    is_farmer_priced?: boolean;
}
export interface FarmerDashboardMetrics {
    total_earnings: number;
    total_sales: number;
    lifetime_earnings: number;
    current_month_earnings: number;
    monthly_earnings: number;
    total_products: number;
    live_products: number;
    avg_rating: number;
    total_orders: number;
    weekly_sales: number;
    monthly_sales: number;
    pending_payouts: number;
    unread_notifications_count: number;
    growth_percentage: number;
    recent_transactions: Array<{
        id: string;
        amount: number;
        status: string;
        date: string;
        type: string;
        description: string;
    }>;
    sales_7d: Array<{
        d: string;
        v: number;
    }>;
    sales_30d: Array<{
        d: string;
        v: number;
    }>;
}
export interface FarmerPayout {
    id: string;
    amount: number;
    status: "pending" | "processing" | "completed";
    created_at: string;
    completed_at: string | null;
}
export interface PendingBankChange {
    account_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name?: string;
    upi_id?: string;
    submitted_at?: string | null;
}
export interface FarmerBankDetails {
    id?: number;
    account_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    upi_id?: string;
    is_verified?: boolean;
    /** NONE | PENDING | APPROVED | REJECTED — a payout-account change awaits FOS approval. */
    approval_status?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
    rejection_reason?: string;
    reviewed_at?: string | null;
    pending_change?: PendingBankChange | null;
}
export interface FarmerNotification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    notification_type?: 'new_order' | 'payment_credited' | 'quality_alert' | 'pickup_scheduled' | 'general';
    metadata?: Record<string, unknown>;
    is_read: boolean;
    created_at: string;
}
export interface FarmerOrder {
    id: string;
    tracking_id: string;
    customer_name: string;
    status: string;
    total: number;
    created_at: string;
    items: Array<{
        product_name: string;
        quantity: number;
        unit: string;
        price: number;
        total: number;
    }>;
}
export type PosPaymentMethod = "Cash" | "UPI" | "Card" | "Sodexo" | "Wallet";
export type WastageReason = "Spoiled" | "Damaged" | "Expired";
export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";
/** A live "buy N get M free" rule on a variant. Served by the catalog endpoints;
 *  the server always re-derives the actual discount at sale time. */
export interface PosOffer {
    label: string;
    buy_qty: number;
    get_qty: number;
    max_sets?: number | null;
}
export interface PosProduct {
    pid: string;
    sku?: string;
    /** The weighing scale's PLU number — first segment of the QR it prints. */
    plu_code?: number | null;
    /** Batch number printed in the scale's QR (W-<plu_code>-<batch_no>-<grams>). */
    batch_no?: number | null;
    name: string;
    price: number;
    weighed: boolean;
    category: string;
    stock: number;
    low_stock_threshold: number;
    member_eligible?: boolean;
    offer?: PosOffer | null;
}
export interface PosCartItem {
    pid: string;
    name: string;
    unit_price: number;
    weighed: boolean;
    quantity: number;
    member_eligible?: boolean;
    gst_rate?: number;
}
export interface PosTender {
    method: PosPaymentMethod;
    amount: number;
}
export interface PosCustomer {
    id: string;
    name: string;
    first_name?: string;
    last_name?: string;
    phone: string;
    email?: string;
    tier?: LoyaltyTier;
    points?: number;
    pride?: boolean;
    wallet_balance?: number;
    remaining_pride_limit?: number;
    is_b2b?: boolean;
    type?: 'B2B' | 'RETAIL';
    pride_discount_pct?: number;
}
export interface PosCompanyProfile {
    id: string;
    name: string;
    gstin: string;
    address?: string;
    pan?: string;
    email?: string;
}
export interface PosSettings {
    pride_discount_pct: number;
    rounding_enabled: boolean;
    rounding_slab: number;
    max_manual_discount_pct: number;
    /** Cash over/short within this amount is ignored (₹). */
    cash_variance_tolerance?: number;
    /** HH:MM store-close time; after this a shift close is the day-end close. */
    shift_auto_close_time?: string;
}
export interface PosOrderRequest {
    customer_id?: string;
    items: PosCartItem[];
    tenders: PosTender[];
    subtotal: number;
    member_discount: number;
    manual_discount_percentage?: number;
    manual_discount_amount?: number;
    discount_reason?: string;
    discount_applied_by_id?: string;
    /** OTP-verified manager authorization id (legacy refund path). */
    discount_authorization_id?: string;
    /** Approved DiscountApprovalRequest id — required when a manual discount is applied. */
    discount_approval_id?: string;
    surcharge: number;
    rounding_adjustment?: number;
    wallet_credit_amount?: number;
    total: number;
    receipt_delivery?: "Print" | "WhatsApp" | "SMS";
    is_anonymous?: boolean;
    is_b2b?: boolean;
    company_id?: string;
}
export interface PosTransaction {
    id: string;
    customer_id: string;
    items: PosCartItem[];
    tenders: PosTender[];
    method: PosPaymentMethod | "Split";
    subtotal: number;
    member_discount: number;
    pride_limit_used: number;
    surcharge: number;
    total: number;
    timestamp: number;
    receipt_delivery?: "Print" | "WhatsApp" | "SMS";
    manual_discount_percentage?: number;
    manual_discount_amount?: number;
    discount_reason?: string;
    discount_applied_by_id?: string;
    discount_applied_by_name?: string;
    rounding_adjustment?: number;
    is_anonymous?: boolean;
    is_b2b?: boolean;
    company?: PosCompanyProfile;
    invoice_number?: string;
}
export interface PosShift {
    started_at: number;
    opening_cash: number;
    cash_sales: number;
    total_sales: number;
    txn_count: number;
    rounding_loss?: number;
}
export interface PosShiftOpenRequest {
    employee_id: string;
    opening_cash: number;
    /** Stable per-terminal id — lets the backend refuse a 2nd device for the same operator. */
    device_id?: string;
}
export interface PosShiftCloseRequest {
    closing_cash: number;
    notes?: string;
    manager_pin?: string;
    /** Day-end dual control: the manager's independent re-count of the drawer. */
    manager_counted_cash?: number;
}
export interface PosShiftSummary extends PosShift {
    closing_cash: number;
    variance: number;
    transactions: PosTransaction[];
}
export interface PosWastageEntry {
    pid: string;
    name: string;
    quantity: number;
    weighed: boolean;
    unit_price: number;
    reason: WastageReason;
}
export interface PosLoginRequest {
    employee_id: string;
    pin: string;
}
export type WSChannel = "orders" | "picker" | "delivery" | "delivery/track" | "admin";
export interface WSOrderEvent {
    type: "order_status_changed";
    tracking_id: string;
    status: OrderStatus;
    timestamp: string;
}
export interface WSPickerEvent {
    type: "new_order" | "order_cancelled";
    order_id: string;
    customer: string;
    item_count: number;
    priority: PickerOrderPriority;
}
export interface WSDeliveryEvent {
    type: "new_assignment" | "assignment_cancelled";
    mission: DeliveryMission;
}
export interface WSDeliveryTrackingEvent {
    type: "driver_location_update";
    data: {
        driverId: string;
        orderId: string;
        lat: number;
        lng: number;
        speed?: number;
        timestamp: string;
    };
}
export type WSEvent = WSOrderEvent | WSPickerEvent | WSDeliveryEvent | WSDeliveryTrackingEvent;
export interface WebPushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
export interface NotificationMessage {
    id?: string;
    title: string;
    body: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    data?: Record<string, unknown>;
    timestamp?: string;
}
export interface NotificationOptions {
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
    actions?: Array<{
        action: string;
        title: string;
    }>;
}
export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}
export interface ApiError {
    status: number;
    message: string;
    detail?: string;
    errors?: Record<string, string[]>;
}
export type PackagingVariant = "BULK_UNPACKED" | "FRESHON_BRANDED" | "CUSTOM_BRANDED";
export type B2BTier = "SILVER" | "GOLD" | "PLATINUM";
export type B2BCustomerStatus = "PENDING_KYC" | "ACTIVE" | "SUSPENDED" | "REJECTED";
export type B2BBusinessType = "RETAILER" | "RESELLER" | "HORECA" | "INSTITUTION" | "OTHER";
export interface B2BCustomer {
    id: string;
    business_name: string;
    business_type: B2BBusinessType;
    gstin: string;
    pan: string;
    tier: B2BTier;
    status: B2BCustomerStatus;
    min_order_value: string;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    billing_address: string;
    city: string;
    state: string;
    pincode: string;
    created_at: string;
}
export interface B2BRegisterRequest {
    business_name: string;
    business_type?: B2BBusinessType;
    gstin?: string;
    pan?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    billing_address?: string;
    city?: string;
    state?: string;
    pincode?: string;
}
export type CustomerBrandStatus = "DRAFT" | "APPROVED" | "REJECTED";
export interface CustomerBrand {
    id: string;
    brand_name: string;
    logo_image: string | null;
    packaging_spec: string;
    status: CustomerBrandStatus;
    review_note: string;
    created_at: string;
}
export interface BuyerPackagingStock {
    id: string;
    brand: string;
    brand_name: string;
    variant: number;
    pack_unit: string;
    qty_received: number;
    qty_consumed: number;
    qty_available: number;
}
export interface B2BPriceBreakdown {
    goods: string;
    overhead_allocation: string;
    packing_labour: string;
    freshon_material: string;
    base_cost: string;
    margin_amount: string;
}
export interface B2BPrice {
    id: string;
    product: number;
    product_name: string;
    variant: number | null;
    pack_unit: string;
    packaging_variant: PackagingVariant;
    tier: B2BTier | null;
    price: string;
    landed_cost: string;
    cost_breakdown: B2BPriceBreakdown | Record<string, unknown>;
    status: "ACTIVE" | "SUPERSEDED";
    effective_date: string;
    created_at: string;
}
export interface B2BCatalogProduct {
    product_id: number;
    name: string;
    category: string | null;
    hsn_code: string;
    card_image: string | null;
    prices: B2BPrice[];
}
export interface PriceSuggestRequest {
    packaging_variant: PackagingVariant;
    landed_cost: number | string;
    pack_unit?: string;
    product?: number;
    variant?: number;
}
export interface PriceSuggestResponse {
    packaging_variant: PackagingVariant;
    suggested_price: string;
    margin_pct: string;
    components: B2BPriceBreakdown;
    allocation_basis: string;
}
export interface PriceApproveRequest {
    product: number;
    variant?: number | null;
    packaging_variant: PackagingVariant;
    tier?: B2BTier | null;
    price: number | string;
    landed_cost?: number | string;
    cost_breakdown?: Record<string, unknown>;
}
export interface OverheadConfig {
    monthly_rent: string;
    monthly_salaries: string;
    monthly_misc: string;
    allocation_basis: "PER_UNIT" | "PCT_REVENUE";
    throughput_base: string;
    target_margin_pct: string;
    packing_labour_per_unit: string;
    freshon_material_cost: Record<string, number>;
    default_material_cost: string;
    updated_at: string;
}
export type B2BSlotType = "SCHEDULED_DATE" | "NEXT_DAY" | "EARLY_AM_BULK" | "CUSTOM";
export interface B2BDeliverySlot {
    id: string;
    title: string;
    description: string;
    slot_type: B2BSlotType;
    delivery_fee: string;
    lead_time_hours: number;
    min_order_value: string;
    available: boolean;
}
export interface B2BCheckoutConfig {
    advance_payment_required: boolean;
    cod_enabled: boolean;
    allowed_payment_methods: string[];
    free_delivery_threshold: string;
    min_order_value: string;
    updated_at: string;
}
export type B2BQuoteStatus = "REQUESTED" | "PRICED" | "APPROVED" | "EXPIRED" | "CONVERTED" | "REJECTED";
export interface B2BQuoteItem {
    id?: string;
    product: number;
    product_name?: string;
    variant?: number | null;
    packaging_variant: PackagingVariant;
    brand?: string | null;
    qty: string | number;
    unit?: string;
    quoted_unit_price?: string | null;
}
export interface B2BQuote {
    id: string;
    quote_number: string;
    status: B2BQuoteStatus;
    items: B2BQuoteItem[];
    agent_suggestion: Record<string, unknown>;
    founder_note: string;
    expires_at: string | null;
    created_at: string;
}
export type B2BOrderStatus = "PENDING_PAYMENT" | "PAID" | "CONFIRMED" | "PACKING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
export type B2BPaymentStatus = "UNPAID" | "PAID" | "REFUNDED";
export type B2BPackagingStatus = "NA" | "AWAITING_MATERIAL" | "READY" | "PACKED";
export interface B2BOrderItem {
    id?: string;
    product: number;
    product_name?: string;
    variant?: number | null;
    batch?: number | null;
    packaging_variant: PackagingVariant;
    brand?: string | null;
    qty: string | number;
    unit?: string;
    unit_price?: string;
    gst_rate?: string | number;
    line_total?: string;
    packaging_status?: B2BPackagingStatus;
}
export interface B2BOrder {
    id: string;
    order_number: string;
    customer: string;
    quote: string | null;
    status: B2BOrderStatus;
    payment_status: B2BPaymentStatus;
    payment_method: string;
    delivery_slot: string | null;
    delivery_window: string;
    delivery_date: string | null;
    delivery_address: string;
    recurring_rule: Record<string, unknown> | null;
    subtotal: string;
    gst: string;
    delivery_fee: string;
    total: string;
    tax_invoice_number: string;
    notes: string;
    items: B2BOrderItem[];
    created_at: string;
    updated_at: string;
    warnings?: string[];
}
export interface PlaceB2BOrderRequest {
    items: B2BOrderItem[];
    delivery_slot?: string;
    delivery_window?: string;
    delivery_address?: string;
    notes?: string;
}
//# sourceMappingURL=types.d.ts.map