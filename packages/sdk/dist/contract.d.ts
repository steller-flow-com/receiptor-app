import type { Receipt } from "./types.js";
export interface RpcOptions {
    rpcUrl: string;
    networkPassphrase: string;
    contractId: string;
}
export declare class ReceiptExistsError extends Error {
    readonly code: "ReceiptExists";
    constructor(message?: string);
}
export declare class InvalidAmountError extends Error {
    readonly code: "InvalidAmount";
    constructor(message?: string);
}
/** Convert a Soroban failure into a stable SDK error where possible. */
export declare function mapContractError(error: unknown): Error;
/** Read a receipt by canonical hash (simulate-only, no auth). */
export declare function getReceipt(opts: RpcOptions, receiptHash: string): Promise<Receipt | null>;
/** Total number of recorded receipts (simulate-only). */
export declare function receiptCount(opts: RpcOptions): Promise<bigint>;
export interface RecordReceiptInput extends RpcOptions {
    merchantSecretKey: string;
    payee: string;
    payer: string;
    asset: string;
    amount: bigint;
    serviceId: string;
    nonce: bigint;
}
export interface RecordReceiptOutput {
    txHash: string;
    receiptHash: string;
}
/**
 * Anchor a receipt on-chain. Requires the merchant's secret key to sign the
 * `record_receipt` invocation. Server-side only; never call from client code.
 */
export declare function recordReceipt(input: RecordReceiptInput): Promise<RecordReceiptOutput>;
//# sourceMappingURL=contract.d.ts.map