import {
  verifyReceiptSignatureEIP712,
  verifyReceiptSignatureJWS,
  type EIP712SignedReceipt,
  type JWSSignedReceipt,
  type ReceiptPayload,
  type SignedReceipt,
} from "@x402/extensions/offer-receipt";
import { isStellarNetwork } from "@x402/stellar";

import type { Receipt } from "./types.js";

/** The official x402 success response extension shape. */
export interface X402PaymentResponse {
  extensions?: {
    "offer-receipt"?: {
      info?: {
        receipt?: unknown;
      };
    };
  };
}

/**
 * The signed x402 receipt does not contain all settlement fields needed by
 * ReceiptLedger. Callers therefore provide the payment context they received
 * from the facilitator alongside the signed artifact.
 */
export interface X402ReceiptInput {
  paymentResponse: unknown;
  payer: string;
  payee: string;
  asset: string;
  amount: bigint;
  serviceId: string;
  nonce: bigint;
}

export interface ParsedX402Receipt {
  payer: string;
  payee: string;
  asset: string;
  amount: bigint;
  serviceId: string;
  nonce: bigint;
  /** Official x402 receipt metadata retained for audit and verification. */
  network: string;
  resourceUrl: string;
  issuedAt: bigint;
  transaction?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReceiptPayload(value: unknown): value is ReceiptPayload {
  if (!isRecord(value)) return false;
  return (
    typeof value.version === "number" &&
    typeof value.network === "string" &&
    typeof value.resourceUrl === "string" &&
    typeof value.payer === "string" &&
    typeof value.issuedAt === "number" &&
    (value.transaction === undefined || typeof value.transaction === "string")
  );
}

function signedReceipt(value: unknown): SignedReceipt {
  if (!isRecord(value) || (value.format !== "jws" && value.format !== "eip712")) {
    throw new Error("x402 receipt is missing a supported format");
  }
  if (typeof value.signature !== "string" || value.signature.length === 0) {
    throw new Error("x402 receipt is missing its signature");
  }

  if (value.format === "jws") {
    if ("payload" in value) {
      throw new Error("JWS x402 receipts must not include a payload");
    }
    return {
      format: "jws",
      signature: value.signature,
    } satisfies JWSSignedReceipt;
  }

  if (!isRecord(value.payload) || !isReceiptPayload(value.payload)) {
    throw new Error("EIP-712 x402 receipt payload is invalid");
  }
  return {
    format: "eip712",
    payload: {
      ...value.payload,
      transaction: value.payload.transaction ?? "",
    },
    signature: value.signature,
  } satisfies EIP712SignedReceipt;
}

function extractReceipt(response: unknown): SignedReceipt {
  if (!isRecord(response)) {
    throw new Error("x402 payment response must be an object");
  }
  const extensions = response.extensions;
  if (!isRecord(extensions)) {
    throw new Error("x402 payment response has no extensions");
  }
  const offerReceipt = extensions["offer-receipt"];
  if (!isRecord(offerReceipt) || !isRecord(offerReceipt.info)) {
    throw new Error("x402 payment response has no offer-receipt extension");
  }
  return signedReceipt(offerReceipt.info.receipt);
}

function isCaipNetwork(value: string): value is `${string}:${string}` {
  const separator = value.indexOf(":");
  return separator > 0 && separator < value.length - 1;
}

function validateSettlement(input: X402ReceiptInput): void {
  if (input.amount <= 0n) throw new Error("x402 settlement amount must be positive");
  if (input.nonce < 0n) throw new Error("x402 settlement nonce must be non-negative");
  if (!input.serviceId.match(/^(0x)?[0-9a-fA-F]{64}$/)) {
    throw new Error("x402 serviceId must be 32 bytes encoded as hex");
  }
}

/**
 * Verify an official x402 signed receipt and combine it with trusted
 * facilitator settlement fields for ReceiptLedger anchoring.
 *
 * The x402 extension verifies the signature but deliberately does not verify
 * signer authorization for the resource URL; that remains an application
 * policy decision outside this parser.
 */
export async function parsePaymentResponse(
  input: X402ReceiptInput,
): Promise<ParsedX402Receipt> {
  validateSettlement(input);
  const receipt = extractReceipt(input.paymentResponse);
  const payload = receipt.format === "jws"
    ? await verifyReceiptSignatureJWS(receipt)
    : (await verifyReceiptSignatureEIP712(receipt)).payload;

  if (payload.version !== 1) {
    throw new Error(`unsupported x402 receipt version: ${payload.version}`);
  }
  if (payload.payer !== input.payer) {
    throw new Error("x402 receipt payer does not match settlement payer");
  }
  if (!payload.network || !payload.resourceUrl || !Number.isSafeInteger(payload.issuedAt)) {
    throw new Error("x402 receipt payload is incomplete");
  }
  if (!isCaipNetwork(payload.network) || !isStellarNetwork(payload.network)) {
    throw new Error(`x402 receipt uses a non-Stellar network: ${payload.network}`);
  }

  return {
    payer: input.payer,
    payee: input.payee,
    asset: input.asset,
    amount: input.amount,
    serviceId: input.serviceId.replace(/^0x/, "").toLowerCase(),
    nonce: input.nonce,
    network: payload.network,
    resourceUrl: payload.resourceUrl,
    issuedAt: BigInt(payload.issuedAt),
    ...(payload.transaction ? { transaction: payload.transaction } : {}),
  };
}

/** Convert parsed x402 data to the contract-shaped SDK receipt fields. */
export function parsedX402ToReceipt(
  parsed: ParsedX402Receipt & { ts?: bigint },
): Omit<Receipt, "ts"> & { ts?: bigint } {
  return {
    payer: parsed.payer,
    payee: parsed.payee,
    asset: parsed.asset,
    amount: parsed.amount,
    serviceId: parsed.serviceId,
    nonce: parsed.nonce,
    ...(parsed.ts === undefined ? {} : { ts: parsed.ts }),
  };
}
