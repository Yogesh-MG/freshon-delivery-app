// packages/freshon-api/src/modules/cashtrail.ts
// Cash custody trail — the hops AFTER the cashier handover (manager → founder →
// bank / expense). Maps to apps/pos/cash_deposit_views.py. Phase 2 (bank-API
// reconciliation) matches BANK deposits against the statement.
import { getClient } from "../client";
/** Record a cash hop: hand to founder, deposit to bank, or spend as an expense. */
export async function recordCashDeposit(data) {
    const res = await getClient().post("/api/pos/cash/deposit/", data);
    return res.data;
}
/** List the cash trail (filter by destination / status / open-only). */
export async function listCashDeposits(params) {
    const res = await getClient().get("/api/pos/cash/deposits/", { params });
    return res.data;
}
/** Founder confirms (or rejects) receipt of a manager → founder transfer. */
export async function confirmCashDeposit(id, action = "confirm", note) {
    const res = await getClient().post(`/api/pos/cash/deposit/${id}/confirm/`, { action, note });
    return res.data;
}
/** Reconciliation funnel: collected → in custody → deposited / expensed. */
export async function getCashTrail() {
    const res = await getClient().get("/api/pos/cash/trail/");
    return res.data;
}
/** Per-person cash-on-hand (received − expensed − banked − passed-on). */
export async function getCashCustodians() {
    const res = await getClient().get("/api/pos/cash/custodians/");
    return res.data;
}
//# sourceMappingURL=cashtrail.js.map