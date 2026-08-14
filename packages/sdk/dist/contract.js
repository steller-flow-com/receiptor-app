import { Account, Contract, Keypair, TransactionBuilder, rpc, scValToNative, } from "@stellar/stellar-sdk";
import { scvAddress, scvBytes32, scvI128, scvU64 } from "./encode.js";
export class ReceiptExistsError extends Error {
    code = "ReceiptExists";
    constructor(message = "receipt already exists") {
        super(message);
        this.name = "ReceiptExistsError";
    }
}
export class InvalidAmountError extends Error {
    code = "InvalidAmount";
    constructor(message = "receipt amount must be positive") {
        super(message);
        this.name = "InvalidAmountError";
    }
}
/** Convert a Soroban failure into a stable SDK error where possible. */
export function mapContractError(error) {
    const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    if (text.includes("ReceiptExists"))
        return new ReceiptExistsError(text);
    if (text.includes("InvalidAmount"))
        return new InvalidAmountError(text);
    return error instanceof Error ? error : new Error(text);
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function toHex(b) {
    return Buffer.from(b).toString("hex");
}
function decodeReceipt(value) {
    if (value == null)
        return null;
    // scValToNative maps a Soroban struct to a plain object with snake_case keys.
    const r = value;
    const addr = (a) => {
        if (typeof a === "object" && a !== null && "toString" in a) {
            return String(a.toString());
        }
        return String(a);
    };
    return {
        payer: addr(r.payer),
        payee: addr(r.payee),
        asset: addr(r.asset),
        amount: BigInt(String(r.amount)),
        serviceId: toHex(r.service_id),
        nonce: BigInt(String(r.nonce)),
        ts: BigInt(String(r.ts)),
    };
}
function simulate(server, op) {
    return server.simulateTransaction(op);
}
function simRetval(sim) {
    return sim.result?.retval ?? null;
}
/** Read a receipt by canonical hash (simulate-only, no auth). */
export async function getReceipt(opts, receiptHash) {
    const server = new rpc.Server(opts.rpcUrl);
    const contract = new Contract(opts.contractId);
    const op = contract.call("get_receipt", scvBytes32(receiptHash));
    const dummy = new Account(Keypair.random().publicKey(), "0");
    const tx = new TransactionBuilder(dummy, {
        fee: "100",
        networkPassphrase: opts.networkPassphrase,
    })
        .addOperation(op)
        .setTimeout(30)
        .build();
    const sim = await simulate(server, tx);
    return decodeReceipt(scValToNative(simRetval(sim)));
}
/** Total number of recorded receipts (simulate-only). */
export async function receiptCount(opts) {
    const server = new rpc.Server(opts.rpcUrl);
    const contract = new Contract(opts.contractId);
    const op = contract.call("receipt_count");
    const dummy = new Account(Keypair.random().publicKey(), "0");
    const tx = new TransactionBuilder(dummy, {
        fee: "100",
        networkPassphrase: opts.networkPassphrase,
    })
        .addOperation(op)
        .setTimeout(30)
        .build();
    const sim = await simulate(server, tx);
    return BigInt(String(scValToNative(simRetval(sim))));
}
/**
 * Anchor a receipt on-chain. Requires the merchant's secret key to sign the
 * `record_receipt` invocation. Server-side only; never call from client code.
 */
export async function recordReceipt(input) {
    if (input.amount <= 0n)
        throw new InvalidAmountError();
    const server = new rpc.Server(input.rpcUrl);
    const contract = new Contract(input.contractId);
    const kp = Keypair.fromSecret(input.merchantSecretKey);
    const source = await server.getAccount(kp.publicKey());
    const tx = new TransactionBuilder(source, {
        fee: "100000",
        networkPassphrase: input.networkPassphrase,
    })
        .addOperation(contract.call("record_receipt", scvAddress(input.payee), scvAddress(input.payer), scvAddress(input.asset), scvI128(input.amount), scvBytes32(input.serviceId), scvU64(input.nonce)))
        .setTimeout(30)
        .build();
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(kp);
    const sent = await server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
        throw mapContractError(new Error(`sendTransaction failed: ${JSON.stringify(sent)}`));
    }
    let result = await server.getTransaction(sent.hash);
    while (result.status === "NOT_FOUND") {
        await sleep(1000);
        result = await server.getTransaction(sent.hash);
    }
    if (result.status !== "SUCCESS") {
        throw mapContractError(new Error(`transaction failed: ${JSON.stringify(result)}`));
    }
    const rv = result.returnValue;
    return {
        txHash: sent.hash,
        receiptHash: toHex(scValToNative(rv)),
    };
}
//# sourceMappingURL=contract.js.map