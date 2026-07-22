// packages/freshon-api/src/modules/wallet.ts
// Wallet, PRIDE Partnership, and Referral module.
// Maps to Django's apps/wallet/ endpoints.
import { getClient } from "../client";
// ─── Wallet ───────────────────────────────────────────────────────────
/**
 * Get current wallet balance.
 * GET /api/wallet/balance/
 */
export async function getBalance() {
    const res = await getClient().get("/api/wallet/balance/");
    return res.data;
}
/**
 * Get wallet details including recent transactions and partnership info.
 * GET /api/wallet/detail/
 */
export async function getWalletDetail() {
    const res = await getClient().get("/api/wallet/detail/");
    return res.data;
}
/**
 * Get transaction history with optional filters.
 * GET /api/wallet/history/
 */
export async function getTransactionHistory(params) {
    const res = await getClient().get("/api/wallet/history/", { params });
    return res.data;
}
// ─── Top-up ───────────────────────────────────────────────────────────
/**
 * Initiate a wallet top-up via Razorpay.
 * POST /api/wallet/initiate_topup/
 */
export async function initiateTopup(data) {
    const res = await getClient().post("/api/wallet/initiate_topup/", data);
    return res.data;
}
/**
 * Verify a completed top-up payment.
 * POST /api/wallet/verify_topup/
 */
export async function verifyTopup(data) {
    const res = await getClient().post("/api/wallet/verify_topup/", data);
    return res.data;
}
/**
 * Get top-up history.
 * GET /api/wallet/topup_history/
 */
export async function getTopupHistory() {
    const res = await getClient().get("/api/wallet/topup_history/");
    return res.data;
}
// ─── PRIDE Partnership ────────────────────────────────────────────────
/**
 * Get current user's PRIDE partnership details.
 * GET /api/partnerships/my_partnership/
 */
export async function getPartnership() {
    const res = await getClient().get("/api/wallet/partnerships/my_partnership/");
    return res.data;
}
/**
 * Request a partnership refund (100% refundable with 1-month notice).
 * POST /api/wallet/partnerships/request_refund/
 */
export async function requestRefund() {
    const res = await getClient().post("/api/wallet/partnerships/request_refund/");
    return res.data;
}
// ─── Referrals ────────────────────────────────────────────────────────
/**
 * Get current user's referral list with total bonus earned.
 * GET /api/wallet/referrals/my_referrals/
 */
export async function getMyReferrals() {
    const res = await getClient().get("/api/wallet/referrals/my_referrals/");
    return res.data;
}
/**
 * Get (or generate) the user's unique referral code and share link.
 * GET /api/wallet/referrals/referral_code/
 */
export async function getReferralCode() {
    const res = await getClient().get("/api/wallet/referrals/referral_code/");
    return res.data;
}
//# sourceMappingURL=wallet.js.map