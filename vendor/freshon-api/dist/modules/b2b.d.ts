import type { B2BCatalogProduct, B2BCheckoutConfig, B2BCustomer, B2BCustomerStatus, B2BDeliverySlot, B2BOrder, B2BOrderStatus, B2BPrice, B2BQuote, B2BRegisterRequest, B2BTier, BuyerPackagingStock, CustomerBrand, OverheadConfig, PlaceB2BOrderRequest, PriceApproveRequest, PriceSuggestRequest, PriceSuggestResponse } from "../types";
/** Create/update the caller's B2B account. POST /api/b2b/register/ */
export declare function b2bRegister(data: B2BRegisterRequest): Promise<B2BCustomer>;
/** Get the caller's B2B account. GET /api/b2b/me/ */
export declare function getMe(): Promise<B2BCustomer>;
/** Update the caller's B2B account. PATCH /api/b2b/me/ */
export declare function updateMe(data: Partial<B2BRegisterRequest>): Promise<B2BCustomer>;
/** Active B2B-priced products (grouped, with per-variant prices). GET /api/b2b/catalog/ */
export declare function getB2BCatalog(): Promise<B2BCatalogProduct[]>;
/** List the caller's quotes. GET /api/b2b/quote/request/ */
export declare function listQuotes(): Promise<B2BQuote[]>;
/** Request a quote. POST /api/b2b/quote/request/ */
export declare function requestQuote(items: B2BQuote["items"]): Promise<B2BQuote>;
/** Get one quote. GET /api/b2b/quote/{id}/ */
export declare function getQuote(id: string): Promise<B2BQuote>;
/** List the caller's brands. GET /api/b2b/brands/ */
export declare function listBrands(): Promise<CustomerBrand[]>;
/** Create a brand. POST /api/b2b/brands/ */
export declare function createBrand(data: {
    brand_name: string;
    packaging_spec?: string;
}): Promise<CustomerBrand>;
/** Update a brand (resets it to DRAFT for re-approval). PATCH /api/b2b/brands/{id}/ */
export declare function updateBrand(id: string, data: Partial<{
    brand_name: string;
    packaging_spec: string;
}>): Promise<CustomerBrand>;
/** Upload a brand logo (reference only — never printed). POST /api/b2b/brands/{id}/ (multipart) */
export declare function uploadBrandLogo(id: string, file: File | Blob): Promise<CustomerBrand>;
/** Buyer-supplied packaging stock balances. GET /api/b2b/packaging/stock/ */
export declare function getPackagingStock(): Promise<BuyerPackagingStock[]>;
/** List the caller's orders. GET /api/b2b/orders/ */
export declare function listB2BOrders(): Promise<B2BOrder[]>;
/** Place an order (prices resolved server-side). POST /api/b2b/orders/ */
export declare function placeB2BOrder(data: PlaceB2BOrderRequest): Promise<B2BOrder>;
/** Get one order. GET /api/b2b/orders/{id}/ */
export declare function getB2BOrder(id: string): Promise<B2BOrder>;
/** Re-order from a previous order (re-prices at current active prices). POST /api/b2b/orders/{id}/reorder/ */
export declare function reorder(id: string): Promise<B2BOrder>;
/** Active B2B delivery slots. GET /api/b2b/delivery-slots/ */
export declare function listB2BSlots(): Promise<B2BDeliverySlot[]>;
/** B2B checkout config (prepaid/COD/payment methods). GET /api/b2b/checkout-config/ */
export declare function getB2BCheckoutConfig(): Promise<B2BCheckoutConfig>;
/** Cost-plus price suggestion + breakdown. POST /api/b2b/pricing/suggest/ */
export declare function suggestPrice(data: PriceSuggestRequest): Promise<PriceSuggestResponse>;
/** List approved/versioned prices. GET /api/b2b/pricing/ */
export declare function listPrices(params?: {
    status?: string;
    product?: number;
}): Promise<B2BPrice[]>;
/** Approve a price → creates an ACTIVE B2BPrice (supersedes prior). POST /api/b2b/pricing/ */
export declare function approvePrice(data: PriceApproveRequest): Promise<B2BPrice>;
/** Get overhead config. GET /api/b2b/overhead/ */
export declare function getOverheadConfig(): Promise<OverheadConfig>;
/** Update overhead config. PUT /api/b2b/overhead/ */
export declare function updateOverheadConfig(data: Partial<OverheadConfig>): Promise<OverheadConfig>;
/** List B2B customers (founder). GET /api/b2b/admin/customers/ */
export declare function adminListCustomers(status?: string): Promise<B2BCustomer[]>;
/** Approve KYC / set tier / set MOV (founder). PATCH /api/b2b/admin/customers/{id}/ */
export declare function adminUpdateCustomer(id: string, data: {
    status?: B2BCustomerStatus;
    tier?: B2BTier;
    min_order_value?: number;
}): Promise<B2BCustomer>;
/** List brands for review (founder). GET /api/b2b/admin/brands/ */
export declare function adminListBrands(status?: string): Promise<CustomerBrand[]>;
/** Approve/reject a brand (founder). PATCH /api/b2b/admin/brands/{id}/ */
export declare function adminReviewBrand(id: string, data: {
    status: "APPROVED" | "REJECTED";
    review_note?: string;
}): Promise<CustomerBrand>;
/** List B2B orders (founder). GET /api/b2b/admin/orders/ */
export declare function adminListOrders(status?: string): Promise<B2BOrder[]>;
/** Mark paid or set status (founder). PATCH /api/b2b/admin/orders/{id}/ */
export declare function adminUpdateOrder(id: string, data: {
    action: "mark_paid";
    payment_method?: string;
} | {
    action: "set_status";
    status: B2BOrderStatus;
}): Promise<B2BOrder>;
/** List packaging receipts. GET /api/b2b/packaging/receipts/ */
export declare function listPackagingReceipts(): Promise<unknown[]>;
/** Create (optionally finalize) a packaging receipt. POST /api/b2b/packaging/receipts/ */
export declare function createPackagingReceipt(data: {
    customer: string;
    brand: string;
    items: {
        variant: number;
        qty: number;
    }[];
    notes?: string;
    finalize?: boolean;
}): Promise<unknown>;
/** Finalize a packaging receipt → credits buyer stock. POST /api/b2b/packaging/receipts/{id}/finalize/ */
export declare function finalizePackagingReceipt(id: string): Promise<unknown>;
/** List all B2B delivery slots (founder). GET /api/b2b/admin/delivery-slots/ */
export declare function adminListSlots(): Promise<B2BDeliverySlot[]>;
/** Create a B2B delivery slot (founder). POST /api/b2b/admin/delivery-slots/ */
export declare function adminCreateSlot(data: Partial<B2BDeliverySlot>): Promise<B2BDeliverySlot>;
/** Update a B2B delivery slot (founder). PATCH /api/b2b/admin/delivery-slots/{id}/ */
export declare function adminUpdateSlot(id: string, data: Partial<B2BDeliverySlot>): Promise<B2BDeliverySlot>;
/** Update B2B checkout config (founder). PUT /api/b2b/admin/checkout-config/ */
export declare function adminUpdateCheckoutConfig(data: Partial<B2BCheckoutConfig>): Promise<B2BCheckoutConfig>;
//# sourceMappingURL=b2b.d.ts.map