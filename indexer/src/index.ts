import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./db/schema.js";
import { ingestEvents } from "./ingest.js";
import { fetchReceiptEvents, fetchSettlementEvents } from "./rpc.js";
import { startServer } from "./server.js";

const required = [
  "SOROBAN_RPC_URL",
  "RECEIPT_LEDGER_CONTRACT_ID",
  "USDC_CONTRACT_ID",
  "DATABASE_URL",
] as const;
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const rpcUrl = process.env.SOROBAN_RPC_URL!;
const contractId = process.env.RECEIPT_LEDGER_CONTRACT_ID!;
const assetContractId = process.env.USDC_CONTRACT_ID!;
const pollSeconds = Number(process.env.POLL_INTERVAL_SECONDS ?? 10);
const configuredStartLedger = Number(process.env.START_LEDGER ?? 1);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function readCursor(): Promise<number> {
  const rows = await db
    .select()
    .from(schema.indexerState)
    .where(eq(schema.indexerState.key, "ledger_cursor"))
    .limit(1);
  const value = rows[0]?.value;
  return value ? Number(value) : configuredStartLedger;
}

async function writeCursor(cursor: number): Promise<void> {
  await db
    .insert(schema.indexerState)
    .values({ key: "ledger_cursor", value: String(cursor) })
    .onConflictDoUpdate({
      target: schema.indexerState.key,
      set: { value: String(cursor) },
    });
}

async function poll(startLedger: number): Promise<number> {
  const [receipts, settlements] = await Promise.all([
    fetchReceiptEvents({ rpcUrl, contractId, startLedger }),
    fetchSettlementEvents({ rpcUrl, assetContractId, startLedger }),
  ]);

  await ingestEvents(db, { receipts, settlements });
  const observedLedgers = [...receipts, ...settlements].map((event) => event.ledger);
  const nextLedger = observedLedgers.length > 0
    ? Math.max(startLedger, Math.max(...observedLedgers) + 1)
    : startLedger;

  if (observedLedgers.length > 0) {
    await writeCursor(nextLedger);
    console.log(
      `ingested ${receipts.length} receipt(s) and ${settlements.length} settlement(s), next ledger ${nextLedger}`,
    );
  }
  return nextLedger;
}

async function main(): Promise<void> {
  let startLedger = await readCursor();
  startLedger = await poll(startLedger);

  let polling = false;
  const interval = setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      startLedger = await poll(startLedger);
    } catch (error) {
      console.error("poll failed:", error);
    } finally {
      polling = false;
    }
  }, pollSeconds * 1000);
  const server = startServer(db);

  const shutdown = async () => {
    clearInterval(interval);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  };
  process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
  process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));
}

main().catch(async (error: unknown) => {
  console.error("indexer failed to start:", error);
  await pool.end();
  process.exitCode = 1;
});
