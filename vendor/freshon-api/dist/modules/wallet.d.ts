import type { Wallet, WalletDetail, WalletTransaction, WalletTopup, TopupInitRequest, TopupInitResponse, TopupVerifyRequest, Partnership, Referral, ReferralCodeResponse, PaginatedResponse } from "../types";
/**
 * Get current wallet balance.
 * GET /api/wallet/balance/
 */
export declare function getBalance(): Promise<Wallet>;
/**
 * Get wallet details including recent transactions and partnership info.
 * GET /api/wallet/detail/
 */
export declare function getWalletDetail(): Promise<WalletDetail>;
/**
 * Get transaction history with optional filters.
 * GET /api/wallet/history/
 */
export declare function getTransactionHistory(params?: {
    reason?: string;
    limit?: number;
    offset?: number;
}): Promise<PaginatedResponse<WalletTransaction>>;
/**
 * Initiate a wallet top-up via Razorpay.
 * POST /api/wallet/initiate_topup/
 */
export declare function initiateTopup(data: TopupInitRequest): Promise<TopupInitResponse>;
/**
 * Verify a completed top-up payment.
 * POST /api/wallet/verify_topup/
 */
export declare function verifyTopup(data: TopupVerifyRequest): Promise<WalletTopup>;
/**
 * Get top-up history.
 * GET /api/wallet/topup_history/
 */
export declare function getTopupHistory(): Promise<WalletTopup[]>;
/**
 * Get current user's PRIDE partnership details.
 * GET /api/partnerships/my_partnership/
 */
export declare function getPartnership(): Promise<Partnership>;
/**
 * Request a partnership refund (100% refundable with 1-month notice).
 * POST /api/wallet/partnerships/request_refund/
 */
export declare function requestRefund(): Promise<{
    message: string;
}>;
/**
 * Get current user's referral list with total bonus earned.
 * GET /api/wallet/referrals/my_referrals/
 */
export declare function getMyReferrals(): Promise<Referral[]>;
/**
 * Get (or generate) the user's unique referral code and share link.
 * GET /api/wallet/referrals/referral_code/
 */
export declare function getReferralCode(): Promise<ReferralCodeResponse>;
//# sourceMappingURL=wallet.d.ts.map