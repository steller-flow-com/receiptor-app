import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./db/schema.js";
import type { ReceiptEvent, SettlementEvent } from "./rpc.js";
type DB = NodePgDatabase<typeof schema>;
/**
 * Ingest a poll batch and rebuild the affected ledger statuses.
 *
 * Inserts are conflict-safe, so replaying a ledger range after a restart does
 * not duplicate receipts, settlements, or double-entry rows.
 */
export declare function ingestEvents(db: DB, batch: {
    receipts: ReceiptEvent[];
    settlements: SettlementEvent[];
}): Promise<void>;
/** Backwards-compatible receipt-only ingestion entry point. */
export declare function ingestReceipts(db: DB, events: ReceiptEvent[]): Promise<void>;
export {};
//# sourceMappingURL=ingest.d.ts.map