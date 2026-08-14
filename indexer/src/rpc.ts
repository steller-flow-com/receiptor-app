import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";

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

type NativeMap = Record<string, unknown>;

type RpcEvent = {
  ledger: number;
  txHash?: string;
  type?: string;
  id?: string;
  operationIndex?: number;
  topic?: xdr.ScVal[];
  value: xdr.ScVal;
};

function toHex(value: unknown): string {
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.from(value).toString("hex");
  }
  throw new Error("expected an XDR byte value");
}

function toAddress(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toString" in value) {
    return String(value);
  }
  throw new Error("expected a Stellar address");
}

function toMap(value: unknown): NativeMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected a contract event map");
  }
  return value as NativeMap;
}

function topicSymbol(value: xdr.ScVal | undefined): string | null {
  if (!value) return null;
  const native = scValToNative(value);
  return typeof native === "string" ? native : null;
}

function isReceiptEvent(event: RpcEvent): boolean {
  const eventName = topicSymbol(event.topic?.[0]);
  // `receipt` is the planned topic; `receipt_recorded` is emitted by the
  // current #[contractevent] macro when no explicit topics are declared.
  return event.type === "contract" &&
    (eventName === "receipt" || eventName === "receipt_recorded");
}

function isTransferEvent(event: RpcEvent): boolean {
  return event.type === "contract" && topicSymbol(event.topic?.[0]) === "transfer";
}

function rpcEvents(
  server: rpc.Server,
  options: {
    startLedger: number;
    contractIds: string[];
  },
): Promise<{ events: RpcEvent[] }> {
  return server.getEvents({
    startLedger: options.startLedger,
    filters: [{ type: "contract", contractIds: options.contractIds }],
    limit: 100,
  }) as Promise<{ events: RpcEvent[] }>;
}

/** Fetch only `ReceiptRecorded` events from the ReceiptLedger contract. */
export async function fetchReceiptEvents(opts: {
  rpcUrl: string;
  contractId: string;
  startLedger: number;
}): Promise<ReceiptEvent[]> {
  const server = new rpc.Server(opts.rpcUrl);
  const response = await rpcEvents(server, {
    startLedger: opts.startLedger,
    contractIds: [opts.contractId],
  });

  const events: ReceiptEvent[] = [];
  for (const event of response.events) {
    if (!isReceiptEvent(event)) continue;
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
export async function fetchSettlementEvents(opts: {
  rpcUrl: string;
  assetContractId: string;
  startLedger: number;
}): Promise<SettlementEvent[]> {
  const server = new rpc.Server(opts.rpcUrl);
  const response = await rpcEvents(server, {
    startLedger: opts.startLedger,
    contractIds: [opts.assetContractId],
  });

  const events: SettlementEvent[] = [];
  response.events.forEach((event, eventIndex) => {
    if (!isTransferEvent(event) || !event.txHash) return;
    const topic = event.topic ?? [];
    const payer = topic[1];
    const payee = topic[2];
    if (payer === undefined || payee === undefined) return;
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
