import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createReceiptJWS } from "@x402/extensions/offer-receipt";
import { parsePaymentResponse, parsedX402ToReceipt } from "../src/x402.js";

async function signedResponse(payer: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicJwk = publicKey.export({ format: "jwk" });
  const kid = `did:jwk:${Buffer.from(JSON.stringify(publicJwk)).toString("base64url")}`;
  const signed = await createReceiptJWS(
    {
      resourceUrl: "https://example.test/api",
      payer,
      network: "stellar:testnet",
      transaction: "",
    },
    {
      kid,
      format: "jws",
      algorithm: "EdDSA",
      async sign(payload) {
        return signBytes(null, Buffer.from(payload), privateKey).toString("base64url");
      },
    },
  );
  return { extensions: { "offer-receipt": { info: { receipt: signed } } } };
}

describe("x402 receipt boundary", () => {
  it("requires the official offer-receipt extension", async () => {
    await expect(
      parsePaymentResponse({
        paymentResponse: {},
        payer: "payer",
        payee: "payee",
        asset: "asset",
        amount: 1n,
        serviceId: "a".repeat(64),
        nonce: 1n,
      }),
    ).rejects.toThrow("no extensions");
  });

  it("verifies a signed receipt and combines settlement fields", async () => {
    const payer = "Gpayer";
    const parsed = await parsePaymentResponse({
      paymentResponse: await signedResponse(payer),
      payer,
      payee: "Gpayee",
      asset: "Casset",
      amount: 10n,
      serviceId: "A".repeat(64),
      nonce: 2n,
    });

    expect(parsed).toMatchObject({
      payer,
      payee: "Gpayee",
      asset: "Casset",
      amount: 10n,
      serviceId: "a".repeat(64),
      nonce: 2n,
      network: "stellar:testnet",
      resourceUrl: "https://example.test/api",
    });
  });

  it("keeps enriched settlement fields contract-shaped", () => {
    expect(
      parsedX402ToReceipt({
        payer: "payer",
        payee: "payee",
        asset: "asset",
        amount: 10n,
        serviceId: "a".repeat(64),
        nonce: 2n,
        network: "stellar:testnet",
        resourceUrl: "https://example.test/api",
        issuedAt: 3n,
      }),
    ).toEqual({
      payer: "payer",
      payee: "payee",
      asset: "asset",
      amount: 10n,
      serviceId: "a".repeat(64),
      nonce: 2n,
    });
  });
});
