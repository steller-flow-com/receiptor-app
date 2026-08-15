import { rpc, scValToNative } from "@stellar/stellar-sdk";
function toHex(value) {
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return Buffer.from(value).toString("hex");
    }
    throw new Error("expected an XDR byte value");
}
function toAddress(value) {
    if (typeof value === "string")
        return value;
    if (typeof value === "object" && value !== null && "toString" in value) {
        return String(value);
    }
    throw new Error("expected a Stellar address");
}
function toMap(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("expected a contract event map");
    }
    return value;
}
function topicSymbol(value) {
    if (!value)
        return null;
    const native = scValToNative(value);
    return typeof native === "string" ? native : null;
}
function isReceiptEvent(event) {
    const eventName = topicSymbol(event.topic?.[0]);
    // `receipt` is the planned topic; `receipt_recorded` is emitted by the
    // current #[contractevent] macro when no explicit topics are declared.
    return event.type === "contract" &&
        (eventName === "receipt" || eventName === "receipt_recorded");
}
function isTransferEvent(event) {
    return event.type === "contract" && topicSymbol(event.topic?.[0]) === "transfer";
}
function rpcEvents(server, options) {
    return server.getEvents({
        startLedger: options.startLedger,
        filters: [{ type: "contract", contractIds: options.contractIds }],
        limit: 100,
    });
}
/** Fetch only `ReceiptRecorded` events from the ReceiptLedger contract. */
export async function fetchReceiptEvents(opts) {
    const server = new rpc.Server(opts.rpcUrl);
    const response = await rpcEvents(server, {
        startLedger: opts.startLedger,
        contractIds: [opts.contractId],
    });
    const events = [];
    for (const event of response.events) {
        if (!isReceiptEvent(event))
            continue;
        const data = toMap(scValToNative(event.value));
        events.push({
            receiptHash: toHex(data.receipt_hash),
            payer: toAddress(data.payer),
            payee: toAddress(data.payee),
            asset: toAddress(data.asset),
            amount: BigInt(String(data.amount)),
            serviceId: toHex(data.service_id),
            nonce: BigInt(String(data.nonce)),
            ts: BigInt(String(data.ts)),
            ledger: event.ledger,
        });
    }
    return events;
}
/** Fetch token `transfer` events used to reconcile settlements with receipts. */
export async function fetchSettlementEvents(opts) {
    const server = new rpc.Server(opts.rpcUrl);
    const response = await rpcEvents(server, {
        startLedger: opts.startLedger,
        contractIds: [opts.assetContractId],
    });
    const events = [];
    response.events.forEach((event, eventIndex) => {
        if (!isTransferEvent(event) || !event.txHash)
            return;
        const topic = event.topic ?? [];
        const payer = topic[1];
        const payee = topic[2];
        if (payer === undefined || payee === undefined)
            return;
        events.push({
            txHash: event.txHash,
            opIndex: event.operationIndex ?? eventIndex,
            payer: toAddress(scValToNative(payer)),
            payee: toAddress(scValToNative(payee)),
            asset: opts.assetContractId,
            amount: BigInt(String(scValToNative(event.value))),
            ledger: event.ledger,
        });
    });
    return events;
}
//# sourceMappingURL=rpc.js.map