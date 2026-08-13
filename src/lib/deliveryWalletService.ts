import { apiClient } from "./apiClient";
import { ApiResult } from "./types";

export interface WalletTransaction {
  id: string;
  type: "CREDIT" | "DEBIT" | "REVERSAL";
  reason: string;
  amount: string;
  description: string;
  matures_at: string | null;
  created_at: string;
}

export interface WalletSummary {
  available: string;
  pending: string;
  total_earned: string;
  total_withdrawn: string;
  hold_hours: number;
  next_matures_at: string | null;
  transactions: WalletTransaction[];
}

export type WithdrawMethod = "UPI" | "BANK";

export interface Withdrawal {
  id: string;
  amount: string;
  method: WithdrawMethod;
  status: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";
  reference: string;
  note: string;
  upi_id: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  processed_by: string | null;
  requested_at: string;
  processed_at: string | null;
}

export class DeliveryWalletService {
  static async getWallet(): Promise<ApiResult<WalletSummary>> {
    const res = await apiClient.get<WalletSummary>("/api/delivery-partner/wallet/");
    if (res.error) return { success: false, error: res.error, errorCode: res.errorCode };
    return { success: true, data: res.data };
  }

  /**
   * Request a payout.
   *
   * `idempotencyKey` is what stops one tap becoming two payouts: the UI blocks
   * double-taps, but a lost response is invisible to that guard — the rider
   * asks for Rs 2,000, the reply dies in a lift, they tap again, and without a
   * key that is Rs 4,000 out. Re-sending the same key returns the original
   * withdrawal instead of debiting twice.
   */
  static async requestWithdrawal(
    amount: number,
    method: WithdrawMethod,
    idempotencyKey?: string,
  ): Promise<ApiResult<Withdrawal>> {
    const res = await apiClient.post<Withdrawal>("/api/delivery-partner/wallet/withdraw/", {
      amount,
      method,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    });
    if (res.error) return { success: false, error: res.error, errorCode: res.errorCode };
    return { success: true, data: res.data };
  }

  static async getWithdrawals(): Promise<ApiResult<Withdrawal[]>> {
    const res = await apiClient.get<Withdrawal[]>("/api/delivery-partner/wallet/withdrawals/");
    if (res.error) return { success: false, error: res.error, errorCode: res.errorCode };
    return { success: true, data: res.data };
  }
}
