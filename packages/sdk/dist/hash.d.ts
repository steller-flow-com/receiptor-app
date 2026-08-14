/**
 * Canonical receipt hash.
 *
 * MUST match the `ReceiptLedger` contract byte-for-byte: sha256 over the XDR
 * encoding of an `ScVal::Vec` (scvVec) holding the six fields in fixed order.
 * The contract serializes a `Vec<Val>` via `to_xdr`, which produces exactly
 * `scvVec([payer, payee, asset, amount, service_id, nonce])`.
 */
export interface ReceiptHashFields {
    payer: string;
    payee: string;
    asset: string;
    amount: bigint;
    serviceId: string;
    nonce: bigint;
}
export declare function receiptHash(fields: ReceiptHashFields): string;
//# sourceMappingURL=hash.d.ts.map