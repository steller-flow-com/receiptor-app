export interface ReceiptEvent {
    receiptHash: string;
    payer: string;
    payee: string;
    asset: string;
    amount: bigint;
    serviceId: string;
    nonce: bigint;
    ts: bigint;
    ledger: number;
}
export interface SettlementEvent {
    txHash: string;
    opIndex: number;
    payer: string;
    payee: string;
    asset: string;
    amount: bigint;
    ledger: number;
}
/** Fetch only `ReceiptRecorded` events from the ReceiptLedger contract. */
export declare function fetchReceiptEvents(opts: {
    rpcUrl: string;
    contractId: string;
    startLedger: number;
}): Promise<ReceiptEvent[]>;
/** Fetch token `transfer` events used to reconcile settlements with receipts. */
export declare function fetchSettlementEvents(opts: {
    rpcUrl: string;
    assetContractId: string;
    startLedger: number;
}): Promise<SettlementEvent[]>;
//# sourceMappingURL=rpc.d.ts.map