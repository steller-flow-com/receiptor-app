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
export function receiptToLedgerRows(r) {
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
        { ...base, side: "debit", account: "cash" },
        { ...base, side: "credit", account: "revenue" },
    ];
}
export function toCsv(rows) {
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
    const lines = rows.map((r) => [
        r.receiptHash,
        r.payee,
        r.asset,
        r.amount.toString(),
        r.serviceId,
        r.ts.toString(),
        r.side,
        r.account,
        r.status,
    ].join(","));
    return [header, ...lines].join("\n");
}
//# sourceMappingURL=ledger.js.map