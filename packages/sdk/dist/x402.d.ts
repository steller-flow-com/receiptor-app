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
/**
 * Verify an official x402 signed receipt and combine it with trusted
 * facilitator settlement fields for ReceiptLedger anchoring.
 *
 * The x402 extension verifies the signature but deliberately does not verify
 * signer authorization for the resource URL; that remains an application
 * policy decision outside this parser.
 */
export declare function parsePaymentResponse(input: X402ReceiptInput): Promise<ParsedX402Receipt>;
/** Convert parsed x402 data to the contract-shaped SDK receipt fields. */
export declare function parsedX402ToReceipt(parsed: ParsedX402Receipt & {
    ts?: bigint;
}): Omit<Receipt, "ts"> & {
    ts?: bigint;
};
//# sourceMappingURL=x402.d.ts.map