import { xdr } from "@stellar/stellar-sdk";
/** G.../C... address -> scvAddress. */
export declare function scvAddress(addr: string): xdr.ScVal;
/** u64 -> scvU64. */
export declare function scvU64(value: bigint): xdr.ScVal;
/** i128 -> scvI128. */
export declare function scvI128(value: bigint): xdr.ScVal;
/** 32-byte hex (64 hex chars) -> scvBytes. */
export declare function scvBytes32(hex: string): xdr.ScVal;
/** 32-byte hex (64 hex chars) -> Buffer. */
export declare function bytes32(hex: string): Buffer;
//# sourceMappingURL=encode.d.ts.map