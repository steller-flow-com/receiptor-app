/** A recorded x402 payment receipt (mirrors the `Receipt` contract type). */
export interface Receipt {
    payer: string;
    payee: string;
    asset: string;
    amount: bigint;
    serviceId: string;
    nonce: bigint;
    ts: bigint;
}
/** One row of the double-entry revenue subledger. */
export interface LedgerRow {
    receiptHash: string;
    payee: string;
    asset: string;
    amount: bigint;
    serviceId: string;
    ts: bigint;
    /** "debit" | "credit" */
    side: "debit" | "credit";
    /** "cash" (USDC) | "revenue" */
    account: "cash" | "revenue";
    status: "receipted" | "unreceipted_settlement" | "receipt_without_settlement";
}
//# sourceMappingURL=types.d.ts.map