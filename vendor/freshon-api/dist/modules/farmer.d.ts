import type { FarmerProfileUpdate, FarmerBatch, FarmerAddBatchRequest, FarmerDashboardMetrics, FarmerPayout, FarmerRegistrationRequest, CurrentUser, FarmerBankDetails, FarmerNotification, FarmerOrder, FarmerPurchaseOrder } from "../types";
/**
 * Register or authenticate a farmer via phone + OTP.
 * POST /api/farmer/register/
 *
 * Step 1: Send { phone } to receive an OTP.
 * Step 2: Send { phone, otp } to verify and get tokens.
 */
export declare function registerFarmer(data: FarmerRegistrationRequest): Promise<{
    message: string;
    debug_otp?: string;
    is_new_user?: boolean;
    profile_complete?: boolean;
    user?: CurrentUser;
    access?: string;
    refresh?: string;
}>;
/**
 * Let an already-authenticated user (e.g. a consumer) add the FARMER role and
 * create a farmer profile on their existing account — no second OTP.
 * POST /api/farmer/become/
 */
export declare function becomeFarmer(name?: string): Promise<{
    created: boolean;
    profile_complete: boolean;
    roles: string[];
    profile: FarmerProfileUpdate & {
        id: number;
    };
}>;
/**
 * Get the farmer's profile.
 * GET /api/farmer/profile/
 */
export declare function getProfile(): Promise<FarmerProfileUpdate & {
    id: number;
}>;
/**
 * Update the farmer's profile.
 * PATCH /api/farmer/profile/
 */
export declare function updateProfile(data: FarmerProfileUpdate): Promise<FarmerProfileUpdate & {
    id: number;
}>;
/**
 * Upload farm/product video or profile photo.
 * POST /api/farmer/media/
 *
 * Uses FormData for file upload.
 */
export declare function uploadMedia(type: "farm_video" | "product_video" | "profile_photo", file: File | Blob): Promise<{
    url: string;
    type: string;
}>;
/**
 * Get the farmer's aggregated dashboard metrics.
 * GET /api/farmer/dashboard/
 */
export declare function getDashboard(): Promise<FarmerDashboardMetrics>;
/**
 * List the farmer's own inventory batches.
 * GET /api/farmer/batches/
 */
export declare function listBatches(): Promise<FarmerBatch[]>;
/**
 * Add a new harvest batch.
 * POST /api/farmer/batches/
 */
export declare function addBatch(data: FarmerAddBatchRequest): Promise<FarmerBatch>;
/**
 * Update an existing batch (e.g. update stock after harvest).
 * PATCH /api/farmer/batches/{id}/
 */
export declare function updateBatch(id: string, data: Partial<FarmerAddBatchRequest>): Promise<FarmerBatch>;
/**
 * Get the farmer's payout history.
 * GET /api/farmer/payouts/
 */
export declare function getPayouts(): Promise<FarmerPayout[]>;
/**
 * Get the farmer's bank account details.
 * GET /api/farmer/bank/
 */
export declare function getBankDetails(): Promise<FarmerBankDetails>;
/**
 * Update the farmer's bank account details.
 * POST /api/farmer/bank/
 */
export declare function updateBankDetails(data: Partial<FarmerBankDetails>): Promise<FarmerBankDetails>;
/**
 * Submit the (completed) farmer profile for FOS verification.
 * POST /api/farmer/submit-for-review/
 * Returns 400 with `missing_sections` if required fields aren't filled.
 */
export declare function submitForReview(): Promise<{
    verification_status: string;
    submitted_at?: string;
}>;
/**
 * List the farmer's own purchase orders. GET /api/farmer/purchase-orders/
 * @param status optional PENDING | APPROVED | REJECTED | RECEIVED filter
 */
export declare function listPurchaseOrders(status?: string): Promise<FarmerPurchaseOrder[]>;
export interface FarmerApprovalEntry {
    id: number;
    name: string;
    verification_status: string;
    missing_sections: string[];
    submitted_at?: string | null;
    partnership_type?: string;
}
/** FOS admin: list farmers awaiting verification. GET /api/farmer/fos/approvals/ */
export declare function listFarmerApprovals(): Promise<{
    pending: FarmerApprovalEntry[];
    count: number;
}>;
/**
 * FOS admin: approve or reject a farmer's verification.
 * POST /api/farmer/fos/approvals/{farmerId}/decide/
 */
export declare function decideFarmerApproval(farmerId: number | string, action: "approve" | "reject", reason?: string): Promise<unknown>;
export interface FarmerPriceReview {
    batch_id: number;
    farmer_id: number;
    farmer_name: string;
    product_name: string;
    farmer_price: string;
    farmer_revenue_share: string | null;
    created_at: string;
}
/** FOS admin: price-partner batches whose fixed price awaits an allow/cancel decision. */
export declare function listFarmerPriceReviews(): Promise<{
    pending: FarmerPriceReview[];
    count: number;
}>;
/**
 * FOS admin: allow or cancel a price-partner's farmer-fixed price.
 * POST /api/farmer/fos/farmer-prices/{batchId}/decide/
 * `cancel` reverts to FreshOn pricing (optionally with an override price).
 */
export declare function decideFarmerPrice(batchId: number | string, action: "allow" | "cancel", overridePrice?: number): Promise<{
    batch_id: number;
    farmer_price_status: string;
    is_farmer_priced: boolean;
    purchase_price: string;
}>;
export interface FarmerBankChangeRequest {
    id: number;
    farmer_id: number;
    farmer_name: string;
    farmer_phone: string;
    approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NONE';
    current_account: FarmerBankDetails;
    requested_account: FarmerBankDetails;
    pending_submitted_at?: string | null;
    reviewed_at?: string | null;
    rejection_reason?: string;
}
/**
 * FOS admin: list farmer bank-account changes awaiting approval.
 * GET /api/farmer/fos/bank-changes/
 */
export declare function listFarmerBankChanges(): Promise<{
    pending: FarmerBankChangeRequest[];
    count: number;
}>;
/**
 * FOS admin: approve or reject a farmer's pending bank-account change.
 * POST /api/farmer/fos/bank-changes/{farmerId}/decide/
 */
export declare function decideFarmerBankChange(farmerId: number | string, action: "approve" | "reject", reason?: string): Promise<FarmerBankChangeRequest>;
/**
 * Get the farmer's notifications.
 * GET /api/farmer/notifications/
 */
export declare function getNotifications(): Promise<FarmerNotification[]>;
/**
 * Mark a notification as read (or all if no ID provided).
 * POST /api/farmer/notifications/
 */
export declare function markNotificationRead(id?: string): Promise<{
    status: string;
}>;
/**
 * Get orders containing this farmer's products.
 * GET /api/farmer/orders/
 */
export declare function getOrders(): Promise<FarmerOrder[]>;
/**
 * Update order status (mark packed, request pickup).
 * POST /api/farmer/orders/{id}/status/
 */
export declare function updateOrderStatus(orderId: string, status: string): Promise<{
    status: string;
    order_id: string;
}>;
//# sourceMappingURL=farmer.d.ts.map