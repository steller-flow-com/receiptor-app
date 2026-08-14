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
export function receiptToLedgerRows(
  r: {
    receiptHash: string;
    payee: string;
    asset: string;
    amount: bigint;
    serviceId: string;
    ts: bigint;
    status: LedgerRow["status"];
  },
): LedgerRow[] {
  const base = {
    receiptHash: r.receiptHash,
    payee: r.payee,
    asset: r.asset,
    amount: r.amount,
    serviceId: r.serviceId,
    ts: r.ts,
    status: r.status,
  };
  return [
    { ...base, side: "debit" as const, account: "cash" as const },
    { ...base, side: "credit" as const, account: "revenue" as const },
  ];
}

export function toCsv(rows: LedgerRow[]): string {
  const header = [
    "receipt_hash",
    "payee",
    "asset",
    "amount",
    "service_id",
    "ts",
    "side",
    "account",
    "status",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.receiptHash,
      r.payee,
      r.asset,
      r.amount.toString(),
      r.serviceId,
      r.ts.toString(),
      r.side,
      r.account,
      r.status,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
