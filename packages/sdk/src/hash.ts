import { createHash } from "node:crypto";
import { xdr } from "@stellar/stellar-sdk";

import { scvAddress, scvBytes32, scvI128, scvU64 } from "./encode.js";

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
  serviceId: string; // 32-byte hex
  nonce: bigint;
}

export function receiptHash(fields: ReceiptHashFields): string {
  const vec = xdr.ScVal.scvVec([
    scvAddress(fields.payer),
    scvAddress(fields.payee),
    scvAddress(fields.asset),
    scvI128(fields.amount),
    scvBytes32(fields.serviceId),
    scvU64(fields.nonce),
  ]);
  return createHash("sha256").update(vec.toXDR()).digest("hex");
}
