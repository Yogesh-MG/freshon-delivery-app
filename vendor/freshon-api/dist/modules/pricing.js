// packages/freshon-api/src/modules/pricing.ts
// Price Recommendation Engine — the founder approval loop (PRICING_ENGINE.md §8/§9).
//
// The engine (apps/pricing/engine.py) is deterministic: it turns the entered cost
// month (see ./cost) plus real sales/stock into a price band per SKU, with a
// component-by-component breakdown. The founder approves the CALCULATION, not a
// bare number.
//
//   generate → PENDING → approve → APPROVED (staged) → publish → live price
//                     └→ reject  → REJECTED (counter-price + reason → ML dataset)
//
// Approving does NOT change what customers pay; only `publish` writes
// ProductVariant.price. Rejecting never touches the price at all.
//
// Served by apps/pricing (admin/founder-gated). Requires the apps/pricing 0002
// migration + inventory 0009 on the server.
import { getClient } from "../client";
// ─── Calls ──────────────────────────────────────────────────────────────────────
/**
 * Run the engine. Omit `variantIds` to price every active variant. Re-running
 * supersedes any still-PENDING row for the same variant.
 * Throws if no CostMonth has been entered — the engine will not guess.
 */
export async function generateRecommendations(opts = {}) {
    const res = await getClient().post("/api/pricing/recommendations/generate/", {
        variant_ids: opts.variantIds,
        method: opts.method ?? "hybrid",
        period: opts.period,
    });
    return res.data;
}
/** The founder's approval queue. Defaults to PENDING. */
export async function getRecommendationQueue(status = "PENDING") {
    const res = await getClient().get("/api/pricing/recommendations/", {
        params: { status },
    });
    return res.data;
}
/** Agree with the engine. Stages the price — nothing goes live until `publishPrices`. */
export async function approveRecommendation(id, note = "") {
    const res = await getClient().post(`/api/pricing/recommendations/${id}/decide/`, { action: "approve", note });
    return res.data;
}
/**
 * Disagree with the engine. `founderPrice` and `reasonCode` are both REQUIRED —
 * together with the frozen inputs they form one labelled training row. `note` is
 * required when `reasonCode` is "OTHER". The live price is not touched.
 */
export async function rejectRecommendation(id, founderPrice, reasonCode, note = "") {
    const res = await getClient().post(`/api/pricing/recommendations/${id}/decide/`, { action: "reject", founder_price: String(founderPrice), reason_code: reasonCode, note });
    return res.data;
}
/** The only call that changes a live customer-facing price. APPROVED rows only. */
export async function publishPrices(ids) {
    const res = await getClient().post("/api/pricing/recommendations/publish/", { ids });
    return res.data;
}
//# sourceMappingURL=pricing.js.map