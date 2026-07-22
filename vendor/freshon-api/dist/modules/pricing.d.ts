/** Flat overhead % (Phase 1) vs driver-based allocation (Phase 2). */
export type PricingMethod = "flat" | "hybrid";
export type RecommendationStatus = "PENDING" | "APPROVED" | "REJECTED" | "PUBLISHED" | "SUPERSEDED";
/** Why the founder disagreed — the categorical feature of the training set. */
export type OverrideReason = "COMPETITOR_CHEAPER" | "MARGIN_TOO_THIN" | "MARGIN_TOO_FAT" | "SLOW_MOVER" | "CUSTOMER_EXPECTATION" | "SEASONAL" | "COST_INPUT_WRONG" | "OTHER";
/**
 * Named cost components that summed to `floor`. Keys are present only when the
 * component could be computed — a missing key means "not known", never "zero",
 * and the reason will appear in `flags`.
 */
export interface CostBreakdown {
    landed?: number;
    overhead_flat?: number;
    processing?: number;
    storage?: number;
    value_time?: number;
    financing?: number;
    revenue_share?: number;
    per_unit_overhead?: number;
    per_order_overhead?: number;
    wastage_uplift?: number;
    packaging?: number;
    last_mile?: number;
    payment_gateway?: number;
}
/** The frozen inputs the number was derived from — the ML feature vector. */
export interface RecommendationInputs {
    landed: number;
    unit_kg: number | null;
    dwell_days: number | null;
    units_sold_in_period: number;
    wastage_pct: number;
    processing_cost_per_kg: number;
    storage_rate_per_kg_day: number | null;
    payment_gateway_pct: number;
    daily_interest_rate: number;
    packaging_per_unit: number;
    last_mile_per_order: number;
    avg_units_per_order: number | null;
    category: string;
    mrp: number | null;
    gst_rate: number;
    pools: Record<string, number>;
}
/**
 * Honesty markers. Each names an input that was missing or approximated, so a
 * recommendation built on thin data looks thin. Notable values:
 *   `dwell_unknown_no_sales`   — never sold this period; storage/financing omitted
 *   `transport_not_captured`   — PO has no freight cost; landed is understated
 *   `ceiling_below_floor`      — the market is under our cost; do not sell here
 *   `no_market_data`           — always set today (no competitor scraper yet, §5)
 *   `kg_days_from_snapshot`    — kg-days approximated from current stock, not replayed
 */
export type RecommendationFlag = string;
export interface PriceRecommendation {
    id: string;
    product_name: string;
    variant_unit: string;
    sku: string;
    period: string;
    method: PricingMethod;
    floor: string;
    target: string;
    ceiling: string | null;
    suggested: string;
    current_price: number;
    /**
     * The same fact stated two ways — never mix them up. Cost ₹50 → price ₹100 is a
     * 100% markup but a 50% margin. `markup_pct_on_cost` is null when the category
     * has no configured target margin (unknown, not zero).
     */
    markup_pct_on_cost: number | null;
    margin_pct_on_price: number | null;
    breakdown: CostBreakdown;
    inputs: RecommendationInputs;
    flags: RecommendationFlag[];
    status: RecommendationStatus;
    founder_price: string | null;
    reason_code: OverrideReason | "";
    note: string;
    decided_by: string | null;
    decided_at: string | null;
    published_at: string | null;
    published_price: string | null;
    created_at: string;
}
export interface SkippedVariant {
    variant_id: number;
    product: string;
    unit: string;
    reason: string;
}
export interface RecommendationQueue {
    queue: PriceRecommendation[];
    count: number;
    pending: number;
    approved_unpublished: number;
    reason_codes: {
        value: OverrideReason;
        label: string;
    }[];
}
export interface GenerateResult {
    created: PriceRecommendation[];
    /** Variants we refused to price (no known cost). Never silently dropped. */
    skipped: SkippedVariant[];
    period: string;
    method: PricingMethod;
}
export interface PublishResult {
    published: PriceRecommendation[];
    count: number;
    /** Ids that were not in APPROVED — reported back, not silently ignored. */
    not_publishable: string[];
}
/**
 * Run the engine. Omit `variantIds` to price every active variant. Re-running
 * supersedes any still-PENDING row for the same variant.
 * Throws if no CostMonth has been entered — the engine will not guess.
 */
export declare function generateRecommendations(opts?: {
    variantIds?: number[];
    method?: PricingMethod;
    period?: string;
}): Promise<GenerateResult>;
/** The founder's approval queue. Defaults to PENDING. */
export declare function getRecommendationQueue(status?: RecommendationStatus): Promise<RecommendationQueue>;
/** Agree with the engine. Stages the price — nothing goes live until `publishPrices`. */
export declare function approveRecommendation(id: string, note?: string): Promise<PriceRecommendation>;
/**
 * Disagree with the engine. `founderPrice` and `reasonCode` are both REQUIRED —
 * together with the frozen inputs they form one labelled training row. `note` is
 * required when `reasonCode` is "OTHER". The live price is not touched.
 */
export declare function rejectRecommendation(id: string, founderPrice: number | string, reasonCode: OverrideReason, note?: string): Promise<PriceRecommendation>;
/** The only call that changes a live customer-facing price. APPROVED rows only. */
export declare function publishPrices(ids: string[]): Promise<PublishResult>;
//# sourceMappingURL=pricing.d.ts.map