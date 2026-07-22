export type CashDestination = "FOUNDER" | "BANK" | "EXPENSE";
export type CashDepositStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "MATCHED";
export interface CashDeposit {
    id: string;
    destination: CashDestination;
    amount: number;
    category: string;
    status: CashDepositStatus;
    moved_by: string | null;
    received_by: string | null;
    bank_name: string;
    bank_account: string;
    slip_reference: string;
    deposited_at: string | null;
    sources: string[];
    note: string;
    confirmed_by: string | null;
    confirmed_at: string | null;
    matched_txn_ref: string;
    created_at: string;
}
export interface CashCustodian {
    name: string | null;
    received: number;
    expensed: number;
    banked: number;
    passed_on: number;
    on_hand: number;
}
export interface CashTrailSummary {
    period_start: string;
    collected: number;
    deposited_to_bank: number;
    expensed: number;
    in_custody: number;
    matched_on_statement: number;
    unverified_deposits: number;
    pending_founder_transfers: {
        amount: number;
        count: number;
    };
}
/** Record a cash hop: hand to founder, deposit to bank, or spend as an expense. */
export declare function recordCashDeposit(data: {
    destination: CashDestination;
    amount: number;
    sources?: string[];
    note?: string;
    bank_name?: string;
    bank_account?: string;
    slip_reference?: string;
    category?: string;
}): Promise<CashDeposit>;
/** List the cash trail (filter by destination / status / open-only). */
export declare function listCashDeposits(params?: {
    destination?: CashDestination;
    status?: "open" | CashDepositStatus;
    limit?: number;
}): Promise<{
    deposits: CashDeposit[];
}>;
/** Founder confirms (or rejects) receipt of a manager → founder transfer. */
export declare function confirmCashDeposit(id: string, action?: "confirm" | "reject", note?: string): Promise<CashDeposit>;
/** Reconciliation funnel: collected → in custody → deposited / expensed. */
export declare function getCashTrail(): Promise<CashTrailSummary>;
/** Per-person cash-on-hand (received − expensed − banked − passed-on). */
export declare function getCashCustodians(): Promise<{
    custodians: CashCustodian[];
}>;
//# sourceMappingURL=cashtrail.d.ts.map