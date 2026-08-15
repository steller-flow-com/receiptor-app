import type { IncomingMessage, ServerResponse } from "node:http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./db/schema.js";
type DB = NodePgDatabase<typeof schema>;
/**
 * REST API for the dashboard.
 *
 * Public routes:
 *   GET  /health
 *   GET  /auth/session
 *   POST /auth/login
 *   POST /auth/logout
 *
 * Authenticated routes:
 *   GET  /summary
 *   GET  /receipts
 *   GET  /receipts/:hash
 *   GET  /settlements
 *   GET  /ledger
 *   POST /receipts        (server-side merchant signing)
 *
 * Admin credentials are configured through ADMIN_USERNAME, ADMIN_PASSWORD,
 * and SESSION_SECRET. The browser receives only an HttpOnly signed session.
 */
export declare function startServer(db: DB): import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
export {};
//# sourceMappingURL=server.d.ts.map