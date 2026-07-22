// packages/freshon-api/src/modules/analytics.ts
// Customer analytics — derived RFM / margin / churn shapes served by
// apps/analytics. Admin-only. The reactivation (win-back) list ranks lapsed
// customers by lifetime margin × churn urgency so the FOS operator works the
// most valuable cold customers first. Maps to the reactivation view at
// GET /api/analytics/customers/reactivation/.
import { getClient } from "../client";
/**
 * Margin-ranked list of lapsed customers to win back (admin-only).
 * Server ranking IS the product — never re-sort the candidates client-side.
 * Returns the dormant shape when customer profiles haven't been computed yet.
 */
export async function getReactivation(params) {
    const res = await getClient().get("/api/analytics/customers/reactivation/", { params });
    return res.data;
}
/** Narrowing guard: did the rollup populate profiles yet? */
export function isReactivationDormant(r) {
    return r.dormant === true;
}
/**
 * Real, mutually-exclusive customer segment counts for the FOS cockpit tiles.
 * PRIDE & B2B are always real; the five derived segments are null until the
 * nightly customer-profile rollup has run (UI should show "—", never a fake number).
 */
export async function getCustomerSegments() {
    const res = await getClient().get("/api/analytics/customers/segments/");
    return res.data;
}
//# sourceMappingURL=analytics.js.map