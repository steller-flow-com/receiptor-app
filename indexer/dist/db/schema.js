import { index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
/** Receipts anchored by the ReceiptLedger contract. */
export const receipts = pgTable("receipts", {
    receiptHash: text("receipt_hash").primaryKey(),
    payer: text("payer").notNull(),
    payee: text("payee").notNull(),
    asset: text("asset").notNull(),
    amount: text("amount").notNull(), // bigint as string
    serviceId: text("service_id").notNull(),
    nonce: text("nonce").notNull(),
    ts: text("ts").notNull(),
    ledger: integer("ledger").notNull(),
}, (t) => [index("receipts_payee_idx").on(t.payee)]);
/** USDC settlements observed on-chain (payer -> payee transfers). */
export const settlements = pgTable("settlements", {
    txHash: text("tx_hash").notNull(),
    opIndex: integer("op_index").notNull(),
    payer: text("payer").notNull(),
    payee: text("payee").notNull(),
    asset: text("asset").notNull(),
    amount: text("amount").notNull(), // bigint as string
    ledger: integer("ledger").notNull(),
}, (t) => [
    primaryKey({ columns: [t.txHash, t.opIndex] }),
    index("settlements_payee_idx").on(t.payee),
]);
/** Double-entry rows derived from receipts and settlements. */
export const ledgerEntries = pgTable("ledger_entries", {
    id: text("id").primaryKey(), // `${sourceId}:${side}:${account}`
    receiptHash: text("receipt_hash").notNull(),
    payer: text("payer").notNull(),
    payee: text("payee").notNull(),
    asset: text("asset").notNull(),
    amount: text("amount").notNull(), // bigint as string
    serviceId: text("service_id").notNull(),
    ts: text("ts").notNull(),
    side: text("side").notNull(),
    account: text("account").notNull(),
    status: text("status").notNull(),
}, (t) => [index("ledger_payee_idx").on(t.payee)]);
/** Restart cursor for the event poller. */
export const indexerState = pgTable("indexer_state", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
});
//# sourceMappingURL=schema.js.map