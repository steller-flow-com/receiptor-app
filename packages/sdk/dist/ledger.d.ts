import type { LedgerRow } from "./types.js";
/**
 * Double-entry revenue ledger.
 *
 * Every receipt produces two rows:
 *   - debit  "cash"    (USDC in)
 *   - credit "revenue" (income recognized)
 *
 * The status field separates "receipted" (our contract recorded it) from
 * settlement-only or receipt-without-settlement mismatches, per the
 * "settlement is evidence, not revenue" principle.
 */
export declare function receiptToLedgerRows(r: {
    receiptHash: string;
    payee: string;
    asset: string;
    amount: bigint;
    serviceId: string;
    ts: bigint;
    status: LedgerRow["status"];
}): LedgerRow[];
export declare function toCsv(rows: LedgerRow[]): string;
//# sourceMappingURL=ledger.d.ts.map