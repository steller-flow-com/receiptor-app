import { createHash } from "node:crypto";
import { xdr } from "@stellar/stellar-sdk";
import { scvAddress, scvBytes32, scvI128, scvU64 } from "./encode.js";
export function receiptHash(fields) {
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
//# sourceMappingURL=hash.js.map