export type ValueTier = "champion" | "high" | "mid" | "low" | "margin_unknown";
export type ChurnRisk = "high" | "watch" | "insufficient";
/** Which lifetime value field actually drove ranking/scoring for this pool.
 * "margin" when cost data is broadly available; auto-falls back to "monetary"
 * (spend) otherwise — e.g. POS-origin orders rarely have purchase_price set,
 * so margin_lifetime is honestly zero and monetary_lifetime is the real number. */
export type ValueBasis = "margin" | "monetary";
/** One lapsed customer worth winning back, pre-ranked by the server. */
export interface ReactivationCandidate {
    customer_id: number;
    name: string;
    phone: string | null;
    email: string | null;
    priority_score: number;
    value_basis: ValueBasis;
    value_tier: ValueTier;
    margin_lifetime: number;
    monetary_lifetime: number;
    lifetime_orders: number;
    recency_days: number;
    reorder_cadence_days: number | null;
    churn_risk: ChurnRisk;
    top_products: string[];
    is_pride_member: boolean;
    reason: string;
}
export interface ReactivationCriteria {
    min_orders: number;
    dormant_days: number;
    min_value: number | null;
    exclude_pride: boolean;
}
export interface ReactivationSummary {
    matching: number;
    returned: number;
    value_basis: ValueBasis;
    recoverable_value: number;
    criteria: ReactivationCriteria;
    note: string;
}
/** Live response: ranked candidates + the win-back headline. */
export interface ReactivationResponse {
    summary: ReactivationSummary;
    candidates: ReactivationCandidate[];
    dormant?: false;
}
/** Dormant response: the nightly rollup hasn't populated profiles yet. */
export interface ReactivationDormant {
    dormant: true;
    message: string;
    candidates: [];
    summary: {
        matching: 0;
    };
}
export interface ReactivationParams {
    dormant_days?: number;
    min_orders?: number;
    min_margin?: number;
    limit?: number;
    exclude_pride?: 0 | 1;
}
/**
 * Margin-ranked list of lapsed customers to win back (admin-only).
 * Server ranking IS the product — never re-sort the candidates client-side.
 * Returns the dormant shape when customer profiles haven't been computed yet.
 */
export declare function getReactivation(params?: ReactivationParams): Promise<ReactivationResponse | ReactivationDormant>;
/** Narrowing guard: did the rollup populate profiles yet? */
export declare function isReactivationDormant(r: ReactivationResponse | ReactivationDormant): r is ReactivationDormant;
/** The seven cockpit segments. PRIDE/B2B from membership; the rest RFM-derived. */
export type CustomerSegment = "PRIDE" | "High Value" | "Regular" | "New" | "At Risk" | "Dormant" | "B2B";
export interface CustomerSegmentsResponse {
    /** False when CustomerProfiles haven't been computed — the 5 derived counts are null. */
    profiles_ready: boolean;
    /** Count per segment. The five profile-derived ones are null when !profiles_ready. */
    segments: Record<CustomerSegment, number | null>;
    definitions: {
        priority: string[];
        dormant_days: number;
        note: string;
    };
}
/**
 * Real, mutually-exclusive customer segment counts for the FOS cockpit tiles.
 * PRIDE & B2B are always real; the five derived segments are null until the
 * nightly customer-profile rollup has run (UI should show "—", never a fake number).
 */
export declare function getCustomerSegments(): Promise<CustomerSegmentsResponse>;
//# sourceMappingURL=analytics.d.ts.map