import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";

/** G.../C... address -> scvAddress. */
export function scvAddress(addr: string): xdr.ScVal {
  return Address.fromString(addr).toScVal();
}

/** u64 -> scvU64. */
export function scvU64(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "u64" });
}

/** i128 -> scvI128. */
export function scvI128(value: bigint): xdr.ScVal {
  return nativeToScVal(value, { type: "i128" });
}

/** 32-byte hex (64 hex chars) -> scvBytes. */
export function scvBytes32(hex: string): xdr.ScVal {
  return xdr.ScVal.scvBytes(bytes32(hex));
}

/** 32-byte hex (64 hex chars) -> Buffer. */
export function bytes32(hex: string): Buffer {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (raw.length !== 64) {
    throw new Error(`expected 32 bytes (64 hex chars), got ${raw.length}`);
  }
  return Buffer.from(raw, "hex");
}
