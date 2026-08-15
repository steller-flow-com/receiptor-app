import { inArray } from "drizzle-orm";
import * as schema from "./db/schema.js";
function ledgerRows(source) {
    const base = {
        receiptHash: source.receiptHash,
        payer: source.payer,
        payee: source.payee,
        asset: source.asset,
        amount: source.amount,
        serviceId: source.serviceId,
        ts: source.ts,
        status: source.status,
    };
    return [
        { ...base, id: `${source.sourceId}:debit:cash`, side: "debit", account: "cash" },
        { ...base, id: `${source.sourceId}:credit:revenue`, side: "credit", account: "revenue" },
    ];
}
/**
 * Ingest a poll batch and rebuild the affected ledger statuses.
 *
 * Inserts are conflict-safe, so replaying a ledger range after a restart does
 * not duplicate receipts, settlements, or double-entry rows.
 */
export async function ingestEvents(db, batch) {
    await db.transaction(async (tx) => {
        for (const receipt of batch.receipts) {
            await tx
                .insert(schema.receipts)
                .values({
                receiptHash: receipt.receiptHash,
                payer: receipt.payer,
                payee: receipt.payee,
                asset: receipt.asset,
                amount: receipt.amount.toString(),
                serviceId: receipt.serviceId,
                nonce: receipt.nonce.toString(),
                ts: receipt.ts.toString(),
                ledger: receipt.ledger,
            })
                .onConflictDoNothing({ target: schema.receipts.receiptHash });
        }
        for (const settlement of batch.settlements) {
            await tx
                .insert(schema.settlements)
                .values({
                txHash: settlement.txHash,
                opIndex: settlement.opIndex,
                payer: settlement.payer,
                payee: settlement.payee,
                asset: settlement.asset,
                amount: settlement.amount.toString(),
                ledger: settlement.ledger,
            })
                .onConflictDoNothing();
        }
        const [receipts, settlements] = await Promise.all([
            tx.select().from(schema.receipts),
            tx.select().from(schema.settlements),
        ]);
        const matchedSettlementIndexes = new Set();
        const receiptSources = receipts.map((receipt) => {
            const matchIndex = settlements.findIndex((settlement, index) => !matchedSettlementIndexes.has(index) &&
                settlement.payer === receipt.payer &&
                settlement.payee === receipt.payee &&
                settlement.asset === receipt.asset &&
                settlement.amount === receipt.amount);
            const hasSettlement = matchIndex >= 0;
            if (hasSettlement)
                matchedSettlementIndexes.add(matchIndex);
            return {
                sourceId: receipt.receiptHash,
                receiptHash: receipt.receiptHash,
                payer: receipt.payer,
                payee: receipt.payee,
                asset: receipt.asset,
                amount: receipt.amount,
                serviceId: receipt.serviceId,
                ts: receipt.ts,
                status: hasSettlement ? "receipted" : "receipt_without_settlement",
            };
        });
        const settlementSources = settlements
            .filter((_, index) => !matchedSettlementIndexes.has(index))
            .map((settlement) => {
            const sourceId = `settlement:${settlement.txHash}:${settlement.opIndex}`;
            return {
                sourceId,
                receiptHash: sourceId,
                payer: settlement.payer,
                payee: settlement.payee,
                asset: settlement.asset,
                amount: settlement.amount,
                serviceId: "",
                ts: "0",
                status: "unreceipted_settlement",
            };
        });
        const matchedSettlementSources = settlements
            .filter((_, index) => matchedSettlementIndexes.has(index))
            .flatMap((settlement) => {
            const sourceId = `settlement:${settlement.txHash}:${settlement.opIndex}`;
            return [`${sourceId}:debit:cash`, `${sourceId}:credit:revenue`];
        });
        if (matchedSettlementSources.length > 0) {
            await tx
                .delete(schema.ledgerEntries)
                .where(inArray(schema.ledgerEntries.id, matchedSettlementSources));
        }
        for (const source of [...receiptSources, ...settlementSources]) {
            for (const row of ledgerRows(source)) {
                await tx
                    .insert(schema.ledgerEntries)
                    .values(row)
                    .onConflictDoUpdate({
                    target: schema.ledgerEntries.id,
                    set: row,
                });
            }
        }
    });
}
/** Backwards-compatible receipt-only ingestion entry point. */
export async function ingestReceipts(db, events) {
    await ingestEvents(db, { receipts: events, settlements: [] });
}
//# sourceMappingURL=ingest.js.map