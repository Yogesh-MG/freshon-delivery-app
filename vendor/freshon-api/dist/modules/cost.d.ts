/** What drives a cost — PRICING_ENGINE §2's three rulers + per-order/unit/none. */
export type AllocationDriver = "weight" | "value_time" | "revenue_share" | "per_order" | "per_unit" | "none";
/** Canonical overhead categories. CUSTOM carries a free-text `custom_label`. */
export type CostCategory = "RENT" | "SALARIES" | "MARKETING" | "DELIVERY" | "PACKAGING" | "ELECTRICITY" | "INTERNET" | "LOAN_INTEREST" | "PAYMENT_GATEWAY" | "SOFTWARE" | "SPOILAGE" | "SHRINKAGE" | "RETURNS" | "REFUNDS" | "STORAGE" | "CUSTOM";
export interface OverheadLineItem {
    id: string;
    category: CostCategory;
    custom_label: string | null;
    amount: number;
    is_fixed: boolean;
    allocation_driver: AllocationDriver;
}
/** Per-unit / per-order rates — distinct from monthly totals; the engine multiplies these. */
export interface VariableRates {
    payment_gateway_pct: number;
    packaging_per_unit: number;
    last_mile_per_order: number;
}
export interface CategoryMargin {
    category: string;
    margin_pct: number;
}
export interface WorkingCapital {
    daily_interest_rate: number;
    cash_reserve: number;
}
export interface CostMonth {
    period: string;
    overhead_line_items: OverheadLineItem[];
    variable_rates: VariableRates;
    category_margins: CategoryMargin[];
    working_capital: WorkingCapital;
    entered_at: string | null;
    entered_by: string | null;
    carried_from: string | null;
}
/** "Not entered" sentinel — mirrors the analytics `dormant` pattern. */
export interface CostMonthEmpty {
    period: string;
    entered: false;
}
export type CostMonthResponse = CostMonth | CostMonthEmpty;
/** Narrowing guard: has this month been entered yet? */
export declare function isCostMonthEmpty(r: CostMonthResponse): r is CostMonthEmpty;
/** Derived summary the screen + cockpit both consume (client-side now, server-side later). */
export interface CostSummary {
    period: string;
    total_fixed: number;
    total_variable: number;
    total_overhead: number;
    daily_fixed: number;
    blended_margin_pct: number | null;
    blended_margin_source: "live" | "entered" | "none";
    daily_breakeven_gmv: number | null;
    runway_days: number | null;
    cash_reserve: number | null;
}
/** Human label for a line item (resolves CUSTOM → its custom_label). */
export declare function lineItemLabel(li: Pick<OverheadLineItem, "category" | "custom_label">): string;
export declare const CATEGORY_LABELS: Record<CostCategory, string>;
/** Sensible per-category defaults for a new line item (is_fixed + driver). */
export declare function categoryDefaults(c: CostCategory): {
    is_fixed: boolean;
    allocation_driver: AllocationDriver;
};
/** Current month as "YYYY-MM". */
export declare function currentPeriod(): string;
/** Previous month relative to a "YYYY-MM" period. */
export declare function previousPeriod(period: string): string;
/** Pretty "June 2026" from "YYYY-MM". */
export declare function periodLabel(period: string): string;
/**
 * Derived break-even / runway summary.
 *   dailyFixed         = Σ(fixed line-items) / 30
 *   blendedGrossMargin = live actual (preferred) else avg of entered category margins
 *   dailyBreakevenGMV  = dailyFixed / blendedGrossMargin
 *   runwayDays         = cash_reserve / dailyFixed
 * Honest: returns null fields rather than inventing numbers.
 */
export declare function summarize(month: CostMonth, opts?: {
    liveMarginPct?: number;
}): CostSummary;
/** Fetch one month. Returns the "not entered" sentinel when no record exists. */
export declare function getCostMonth(period?: string): Promise<CostMonthResponse>;
/** List known months + whether each has been entered (for the month switcher). */
export declare function listCostMonths(): Promise<{
    period: string;
    entered: boolean;
}[]>;
/** Upsert a month and return the saved record. */
export declare function saveCostMonth(month: CostMonth): Promise<CostMonth>;
/** Clone the previous month's inputs into `toPeriod` as a draft (not yet saved). */
export declare function carryForward(toPeriod: string): Promise<CostMonth>;
/** A blank, never-saved month — for the "Start fresh" path. */
export declare function emptyDraft(period: string): CostMonth;
/** Make a fresh line item with category-appropriate defaults. */
export declare function newLineItem(category?: CostCategory): OverheadLineItem;
//# sourceMappingURL=cost.d.ts.map