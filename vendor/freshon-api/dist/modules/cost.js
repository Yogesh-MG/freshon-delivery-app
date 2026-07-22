// packages/freshon-api/src/modules/cost.ts
// Cost & Overhead Input — the founder-facing source of truth for company overhead,
// per-unit/order variable rates, category target margins, and working capital.
//
// Feeds BOTH consumers:
//   1. the Price Recommendation Engine (OverheadPool + CategoryMargin — PRICING_ENGINE.md §2/§6)
//   2. the Founder OS cockpit's break-even / cash-runway (replacing the synthesized COSTS).
//
// Served by the apps/pricing backend (admin-gated): GET/POST /api/pricing/cost-month/*,
// /api/pricing/cost-months/, /api/pricing/cost-month/carry-forward/. Requires the
// apps/pricing migration to be applied on the server.
import { getClient } from "../client";
/** Narrowing guard: has this month been entered yet? */
export function isCostMonthEmpty(r) {
    return r.entered === false;
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Human label for a line item (resolves CUSTOM → its custom_label). */
export function lineItemLabel(li) {
    if (li.category === "CUSTOM")
        return li.custom_label?.trim() || "Custom";
    return CATEGORY_LABELS[li.category] ?? li.category;
}
export const CATEGORY_LABELS = {
    RENT: "Rent",
    SALARIES: "Salaries",
    MARKETING: "Marketing",
    DELIVERY: "Delivery",
    PACKAGING: "Packaging",
    ELECTRICITY: "Electricity / Utilities",
    INTERNET: "Internet",
    LOAN_INTEREST: "Loan interest",
    PAYMENT_GATEWAY: "Payment gateway",
    SOFTWARE: "Software",
    SPOILAGE: "Spoilage",
    SHRINKAGE: "Shrinkage",
    RETURNS: "Returns",
    REFUNDS: "Refunds",
    STORAGE: "Storage",
    CUSTOM: "Custom",
};
/** Sensible per-category defaults for a new line item (is_fixed + driver). */
export function categoryDefaults(c) {
    switch (c) {
        case "RENT":
        case "ELECTRICITY":
        case "STORAGE":
            return { is_fixed: true, allocation_driver: "weight" };
        case "LOAN_INTEREST":
            return { is_fixed: true, allocation_driver: "value_time" };
        case "SALARIES":
        case "MARKETING":
        case "SOFTWARE":
        case "INTERNET":
            return { is_fixed: true, allocation_driver: "revenue_share" };
        case "DELIVERY":
            return { is_fixed: false, allocation_driver: "per_order" };
        case "PACKAGING":
            return { is_fixed: false, allocation_driver: "per_unit" };
        case "PAYMENT_GATEWAY":
        case "SPOILAGE":
        case "SHRINKAGE":
        case "RETURNS":
        case "REFUNDS":
        case "CUSTOM":
        default:
            return { is_fixed: false, allocation_driver: "revenue_share" };
    }
}
/** Current month as "YYYY-MM". */
export function currentPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** Previous month relative to a "YYYY-MM" period. */
export function previousPeriod(period) {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(y, (m || 1) - 2, 1); // month is 1-based in period; -1 to index, -1 for prev
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** Pretty "June 2026" from "YYYY-MM". */
export function periodLabel(period) {
    const [y, m] = period.split("-").map(Number);
    if (!y || !m)
        return period;
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
/**
 * Derived break-even / runway summary.
 *   dailyFixed         = Σ(fixed line-items) / 30
 *   blendedGrossMargin = live actual (preferred) else avg of entered category margins
 *   dailyBreakevenGMV  = dailyFixed / blendedGrossMargin
 *   runwayDays         = cash_reserve / dailyFixed
 * Honest: returns null fields rather than inventing numbers.
 */
export function summarize(month, opts) {
    const items = month.overhead_line_items;
    const total_fixed = items.filter((i) => i.is_fixed).reduce((a, i) => a + (i.amount || 0), 0);
    const total_variable = items.filter((i) => !i.is_fixed).reduce((a, i) => a + (i.amount || 0), 0);
    const total_overhead = total_fixed + total_variable;
    const daily_fixed = total_fixed / 30;
    // Blended gross margin — live actual preferred, else simple avg of entered targets.
    let blended_margin_pct = null;
    let blended_margin_source = "none";
    if (opts?.liveMarginPct != null && opts.liveMarginPct > 0) {
        blended_margin_pct = opts.liveMarginPct;
        blended_margin_source = "live";
    }
    else if (month.category_margins.length > 0) {
        const avg = month.category_margins.reduce((a, c) => a + (c.margin_pct || 0), 0) / month.category_margins.length;
        if (avg > 0) {
            blended_margin_pct = avg;
            blended_margin_source = "entered";
        }
    }
    const daily_breakeven_gmv = blended_margin_pct && blended_margin_pct > 0 && daily_fixed > 0
        ? Math.round(daily_fixed / (blended_margin_pct / 100))
        : null;
    const cash_reserve = month.working_capital.cash_reserve || null;
    const runway_days = cash_reserve && daily_fixed > 0 ? Math.round(cash_reserve / daily_fixed) : null;
    return {
        period: month.period,
        total_fixed,
        total_variable,
        total_overhead,
        daily_fixed,
        blended_margin_pct,
        blended_margin_source,
        daily_breakeven_gmv,
        runway_days,
        cash_reserve,
    };
}
// ─── API (apps/pricing) ──────────────────────────────────────────────────────────
/** Client-side id for new, unsaved line-item rows (stable React key before save). */
const uid = (p) => p + Math.random().toString(36).slice(2, 8);
/** Fetch one month. Returns the "not entered" sentinel when no record exists. */
export async function getCostMonth(period) {
    const p = period || currentPeriod();
    const res = await getClient().get("/api/pricing/cost-month/", { params: { period: p } });
    return res.data;
}
/** List known months + whether each has been entered (for the month switcher). */
export async function listCostMonths() {
    const res = await getClient().get("/api/pricing/cost-months/");
    return res.data;
}
/** Upsert a month and return the saved record. */
export async function saveCostMonth(month) {
    const res = await getClient().post("/api/pricing/cost-month/", month);
    return res.data;
}
/** Clone the previous month's inputs into `toPeriod` as a draft (not yet saved). */
export async function carryForward(toPeriod) {
    const res = await getClient().post("/api/pricing/cost-month/carry-forward/", { period: toPeriod });
    return res.data;
}
/** A blank, never-saved month — for the "Start fresh" path. */
export function emptyDraft(period) {
    return {
        period,
        overhead_line_items: [],
        variable_rates: { payment_gateway_pct: 0, packaging_per_unit: 0, last_mile_per_order: 0 },
        category_margins: [],
        working_capital: { daily_interest_rate: 0, cash_reserve: 0 },
        entered_at: null,
        entered_by: null,
        carried_from: null,
    };
}
/** Make a fresh line item with category-appropriate defaults. */
export function newLineItem(category = "CUSTOM") {
    const d = categoryDefaults(category);
    return {
        id: uid("li_"),
        category,
        custom_label: category === "CUSTOM" ? "" : null,
        amount: 0,
        is_fixed: d.is_fixed,
        allocation_driver: d.allocation_driver,
    };
}
//# sourceMappingURL=cost.js.map