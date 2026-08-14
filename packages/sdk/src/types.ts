/** A recorded x402 payment receipt (mirrors the `Receipt` contract type). */
export interface Receipt {
  payer: string; // G... / C... address
  payee: string;
  asset: string; // SAC token contract id, e.g. USDC
  amount: bigint; // raw token units (USDC = 7 decimals)
  serviceId: string; // 32-byte hex (64 hex chars)
  nonce: bigint; // u64
  ts: bigint; // ledger timestamp (u64)
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
