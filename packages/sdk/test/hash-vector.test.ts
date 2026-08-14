import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { receiptHash } from "../src/hash.js";

function publicKey(seedByte: number): string {
  return Keypair.fromRawEd25519Seed(Buffer.alloc(32, seedByte)).publicKey();
}

const vector = {
  payer: publicKey(1),
  payee: publicKey(2),
  asset: publicKey(3),
  amount: 1_234_567n,
  serviceId: "0123456789abcdef".repeat(4),
  nonce: 42n,
};

describe("cross-repo receipt hash vector", () => {
  it("matches the canonical ReceiptLedger encoding", () => {
    expect(receiptHash(vector)).toBe("fbe2f31c4a735c9341e14be0f31a50db23866085ba58ed8871c9c7ba1fb91ad9");
  });
});
