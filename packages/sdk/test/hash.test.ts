import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { receiptHash } from "../src/hash.js";

const fields = {
  payer: Keypair.random().publicKey(),
  payee: Keypair.random().publicKey(),
  asset: Keypair.random().publicKey(),
  amount: 1_000_000n,
  serviceId: "a".repeat(64),
  nonce: 7n,
};

describe("receiptHash", () => {
  it("is deterministic", () => {
    expect(receiptHash(fields)).toBe(receiptHash(fields));
  });

  it("is 32 bytes (64 hex chars)", () => {
    expect(receiptHash(fields)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when any field changes", () => {
    const base = receiptHash(fields);
    expect(receiptHash({ ...fields, nonce: 8n })).not.toBe(base);
    expect(receiptHash({ ...fields, amount: 2_000_000n })).not.toBe(base);
    expect(receiptHash({ ...fields, serviceId: "b".repeat(64) })).not.toBe(base);
    expect(receiptHash({ ...fields, payer: Keypair.random().publicKey() })).not.toBe(base);
  });

  // Cross-repo test vector: the exact expected hash for a fixed input, generated
  // by the ReceiptLedger contract's own test suite, is asserted here during
  // Phase 8 integration.
});
