import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { eq } from "drizzle-orm";
import { recordReceipt } from "@receiptor/sdk";
import * as schema from "./db/schema.js";
const sessionCookie = "receiptor_admin_session";
const defaultWebOrigin = "http://localhost:3000";
function sendJson(res, status, body) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requiredString(body, key) {
    const value = body[key];
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`${key} must be a non-empty string`);
    }
    return value;
}
function requiredBigInt(body, key) {
    const value = requiredString(body, key);
    try {
        return BigInt(value);
    }
    catch {
        throw new Error(`${key} must be an integer string`);
    }
}
async function readJson(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 64 * 1024)
            throw new Error("request body is too large");
        chunks.push(buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function configuredCredentials() {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    const secret = process.env.SESSION_SECRET;
    return username && password && secret ? { username, password, secret } : null;
}
function safeEqual(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
function encodePayload(payload) {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}
function signPayload(payload, secret) {
    return createHmac("sha256", secret).update(payload).digest("base64url");
}
function createSession(username, secret) {
    const ttlSeconds = Number(process.env.SESSION_TTL_SECONDS ?? 28_800);
    const payload = encodePayload({ sub: username, exp: Math.floor(Date.now() / 1000) + ttlSeconds });
    return `${payload}.${signPayload(payload, secret)}`;
}
function requestCookies(req) {
    const cookies = new Map();
    for (const value of req.headers.cookie?.split(";") ?? []) {
        const separator = value.indexOf("=");
        if (separator < 0)
            continue;
        cookies.set(value.slice(0, separator).trim(), decodeURIComponent(value.slice(separator + 1).trim()));
    }
    return cookies;
}
function validSession(req) {
    const credentials = configuredCredentials();
    if (!credentials)
        return false;
    const token = requestCookies(req).get(sessionCookie);
    if (!token)
        return false;
    const separator = token.lastIndexOf(".");
    if (separator < 1)
        return false;
    const payload = token.slice(0, separator);
    const signature = token.slice(separator + 1);
    if (!safeEqual(signature, signPayload(payload, credentials.secret)))
        return false;
    try {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return isRecord(decoded) && typeof decoded.exp === "number" && decoded.exp > Math.floor(Date.now() / 1000) && decoded.sub === credentials.username;
    }
    catch {
        return false;
    }
}
function setSessionCookie(res, token) {
    const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${sessionCookie}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`);
}
function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}
function setCorsHeaders(req, res) {
    const allowedOrigin = process.env.WEB_ORIGIN ?? defaultWebOrigin;
    const requestOrigin = req.headers.origin;
    res.setHeader("Access-Control-Allow-Origin", requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
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
export function startServer(db) {
    const server = createServer(async (req, res) => {
        setCorsHeaders(req, res);
        if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.end();
            return;
        }
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        const path = url.pathname.replace(/\/$/, "") || "/";
        try {
            if (req.method === "GET" && (path === "/" || path === "/health")) {
                sendJson(res, 200, { ok: true, service: "receiptor-indexer" });
                return;
            }
            if (path === "/auth/session" && req.method === "GET") {
                sendJson(res, 200, { authenticated: validSession(req) });
                return;
            }
            if (path === "/auth/login" && req.method === "POST") {
                const credentials = configuredCredentials();
                if (!credentials) {
                    sendJson(res, 503, { error: "admin authentication is not configured" });
                    return;
                }
                const body = await readJson(req);
                if (!isRecord(body))
                    throw new Error("request body must be a JSON object");
                const username = requiredString(body, "username");
                const password = requiredString(body, "password");
                if (!safeEqual(username, credentials.username) || !safeEqual(password, credentials.password)) {
                    sendJson(res, 401, { error: "invalid admin credentials" });
                    return;
                }
                setSessionCookie(res, createSession(username, credentials.secret));
                sendJson(res, 200, { authenticated: true, username });
                return;
            }
            if (path === "/auth/logout" && req.method === "POST") {
                clearSessionCookie(res);
                sendJson(res, 200, { authenticated: false });
                return;
            }
            if (!validSession(req)) {
                sendJson(res, 401, { error: "admin authentication required" });
                return;
            }
            if (req.method === "POST" && path === "/receipts") {
                const body = await readJson(req);
                if (!isRecord(body))
                    throw new Error("request body must be a JSON object");
                const merchantSecretKey = process.env.MERCHANT_SECRET_KEY;
                const networkPassphrase = process.env.NETWORK_PASSPHRASE;
                if (!merchantSecretKey || !networkPassphrase) {
                    sendJson(res, 503, { error: "merchant recording is not configured" });
                    return;
                }
                const result = await recordReceipt({
                    rpcUrl: requiredString({ rpcUrl: process.env.SOROBAN_RPC_URL }, "rpcUrl"),
                    networkPassphrase,
                    contractId: requiredString({ contractId: process.env.RECEIPT_LEDGER_CONTRACT_ID }, "contractId"),
                    merchantSecretKey,
                    payee: requiredString(body, "payee"),
                    payer: requiredString(body, "payer"),
                    asset: requiredString(body, "asset"),
                    amount: requiredBigInt(body, "amount"),
                    serviceId: requiredString(body, "serviceId"),
                    nonce: requiredBigInt(body, "nonce"),
                });
                sendJson(res, 201, { txHash: result.txHash, receiptHash: result.receiptHash });
                return;
            }
            if (req.method !== "GET") {
                sendJson(res, 405, { error: "method not allowed" });
                return;
            }
            if (path === "/receipts") {
                const rows = await db.select().from(schema.receipts);
                sendJson(res, 200, rows);
                return;
            }
            if (path === "/settlements") {
                const rows = await db.select().from(schema.settlements);
                sendJson(res, 200, rows);
                return;
            }
            if (path.startsWith("/receipts/")) {
                const hash = decodeURIComponent(path.slice("/receipts/".length));
                const rows = await db
                    .select()
                    .from(schema.receipts)
                    .where(eq(schema.receipts.receiptHash, hash))
                    .limit(1);
                const receipt = rows[0];
                if (!receipt) {
                    sendJson(res, 404, { error: "receipt not found" });
                    return;
                }
                sendJson(res, 200, receipt);
                return;
            }
            if (path === "/ledger") {
                const rows = await db.select().from(schema.ledgerEntries);
                sendJson(res, 200, rows);
                return;
            }
            if (path === "/summary") {
                const [receipts, entries, settlements] = await Promise.all([
                    db.select().from(schema.receipts),
                    db.select().from(schema.ledgerEntries),
                    db.select().from(schema.settlements),
                ]);
                const statusBySource = new Map();
                for (const entry of entries)
                    statusBySource.set(entry.receiptHash, entry.status);
                let matched = 0;
                let receiptOnly = 0;
                let settlementOnly = 0;
                for (const receipt of receipts) {
                    const status = statusBySource.get(receipt.receiptHash);
                    if (status === "receipted")
                        matched += 1;
                    if (status === "receipt_without_settlement")
                        receiptOnly += 1;
                }
                for (const entry of entries) {
                    if (entry.status === "unreceipted_settlement" && entry.side === "debit")
                        settlementOnly += 1;
                }
                sendJson(res, 200, {
                    receipts: receipts.length,
                    settlements: settlements.length,
                    ledgerEntries: entries.length,
                    matched,
                    receiptOnly,
                    settlementOnly,
                });
                return;
            }
            sendJson(res, 404, { error: "not found" });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const status = message.includes("must be") || message.includes("request body") ? 400 : 500;
            console.error("request failed:", error);
            sendJson(res, status, { error: message });
        }
    });
    const port = Number(process.env.PORT ?? 3001);
    server.listen(port, () => console.log(`indexer API on :${port}`));
    return server;
}
//# sourceMappingURL=server.js.map