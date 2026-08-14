export type IndexedReceipt = {
  receiptHash: string;
  payer: string;
  payee: string;
  asset: string;
  amount: string;
  serviceId: string;
  nonce: string;
  ts: string;
  ledger: number;
};

export type IndexedSettlement = {
  txHash: string;
  opIndex: number;
  payer: string;
  payee: string;
  asset: string;
  amount: string;
  ledger: number;
};

export type LedgerEntry = {
  id: string;
  receiptHash: string;
  payer: string;
  payee: string;
  asset: string;
  amount: string;
  serviceId: string;
  ts: string;
  side: string;
  account: string;
  status: "receipted" | "unreceipted_settlement" | "receipt_without_settlement" | string;
};

export type ApiSummary = {
  receipts: number;
  settlements: number;
  ledgerEntries: number;
  matched: number;
  receiptOnly: number;
  settlementOnly: number;
};

export type ApiSnapshot = {
  receipts: IndexedReceipt[];
  settlements: IndexedSettlement[];
  ledger: LedgerEntry[];
  summary: ApiSummary;
};

export type ReceiptInput = {
  payee: string;
  payer: string;
  asset: string;
  amount: string;
  serviceId: string;
  nonce: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseReceipt(value: unknown): IndexedReceipt | null {
  if (!isRecord(value)) return null;
  const receiptHash = stringValue(value.receiptHash);
  if (!receiptHash) return null;
  return {
    receiptHash,
    payer: stringValue(value.payer),
    payee: stringValue(value.payee),
    asset: stringValue(value.asset),
    amount: stringValue(value.amount, "0"),
    serviceId: stringValue(value.serviceId),
    nonce: stringValue(value.nonce, "0"),
    ts: stringValue(value.ts, "0"),
    ledger: numberValue(value.ledger),
  };
}

function parseSettlement(value: unknown): IndexedSettlement | null {
  if (!isRecord(value)) return null;
  const txHash = stringValue(value.txHash);
  if (!txHash) return null;
  return {
    txHash,
    opIndex: numberValue(value.opIndex),
    payer: stringValue(value.payer),
    payee: stringValue(value.payee),
    asset: stringValue(value.asset),
    amount: stringValue(value.amount, "0"),
    ledger: numberValue(value.ledger),
  };
}

function parseLedgerEntry(value: unknown): LedgerEntry | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  if (!id) return null;
  const rawStatus = stringValue(value.status, "receipt_without_settlement");
  return {
    id,
    receiptHash: stringValue(value.receiptHash),
    payer: stringValue(value.payer),
    payee: stringValue(value.payee),
    asset: stringValue(value.asset),
    amount: stringValue(value.amount, "0"),
    serviceId: stringValue(value.serviceId),
    ts: stringValue(value.ts, "0"),
    side: stringValue(value.side),
    account: stringValue(value.account),
    status: rawStatus,
  };
}

function parseList<T>(value: unknown, parser: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = parser(item);
    return parsed ? [parsed] : [];
  });
}

function parseSummary(value: unknown): ApiSummary {
  if (!isRecord(value)) {
    return { receipts: 0, settlements: 0, ledgerEntries: 0, matched: 0, receiptOnly: 0, settlementOnly: 0 };
  }
  return {
    receipts: numberValue(value.receipts),
    settlements: numberValue(value.settlements),
    ledgerEntries: numberValue(value.ledgerEntries),
    matched: numberValue(value.matched),
    receiptOnly: numberValue(value.receiptOnly),
    settlementOnly: numberValue(value.settlementOnly),
  };
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store", credentials: "include" });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = isRecord(body) ? stringValue(body.error) : "Request failed";
    throw new Error(message || `Indexer returned HTTP ${response.status}`);
  }
  return body;
}

export async function fetchSnapshot(baseUrl: string): Promise<ApiSnapshot> {
  const root = baseUrl.replace(/\/$/, "");
  const [receipts, settlements, ledger, summary] = await Promise.all([
    getJson(`${root}/receipts`),
    getJson(`${root}/settlements`),
    getJson(`${root}/ledger`),
    getJson(`${root}/summary`),
  ]);
  return {
    receipts: parseList(receipts, parseReceipt),
    settlements: parseList(settlements, parseSettlement),
    ledger: parseList(ledger, parseLedgerEntry),
    summary: parseSummary(summary),
  };
}

export async function postReceipt(baseUrl: string, input: ReceiptInput): Promise<{ receiptHash: string; txHash: string }> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/receipts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result: unknown = await response.json();
  if (!response.ok || !isRecord(result)) {
    const message = isRecord(result) ? stringValue(result.error) : "Unable to record receipt";
    throw new Error(message || `Indexer returned HTTP ${response.status}`);
  }
  return {
    receiptHash: stringValue(result.receiptHash),
    txHash: stringValue(result.txHash),
  };
}

export async function checkAdminSession(baseUrl: string): Promise<boolean> {
  const result = await getJson(`${baseUrl.replace(/\/$/, "")}/auth/session`);
  return isRecord(result) && result.authenticated === true;
}

export async function loginAdmin(baseUrl: string, username: string, password: string): Promise<void> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    const message = isRecord(result) ? stringValue(result.error) : "Unable to sign in";
    throw new Error(message || `Indexer returned HTTP ${response.status}`);
  }
}

export async function logoutAdmin(baseUrl: string): Promise<void> {
  await fetch(`${baseUrl.replace(/\/$/, "")}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export function shortAddress(value: string): string {
  return value.length > 14 ? `${value.slice(0, 5)}…${value.slice(-4)}` : value || "—";
}

export function shortHash(value: string): string {
  return value.length > 16 ? `${value.slice(0, 7)}…${value.slice(-5)}` : value || "—";
}

export function formatUnits(raw: string, decimals = 7): string {
  try {
    const value = BigInt(raw);
    const negative = value < 0n;
    const absolute = negative ? -value : value;
    const digits = absolute.toString().padStart(decimals + 1, "0");
    const whole = digits.slice(0, -decimals) || "0";
    const fraction = digits.slice(-decimals).replace(/0+$/, "");
    return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction.slice(0, 2).padEnd(2, "0")}` : ".00"}`;
  } catch {
    return "0.00";
  }
}

export function sumRaw(values: string[]): bigint {
  return values.reduce((total, value) => {
    try {
      return total + BigInt(value);
    } catch {
      return total;
    }
  }, 0n);
}

export function statusLabel(status: string): "Matched" | "Receipt Only" | "Settlement Only" {
  if (status === "unreceipted_settlement") return "Settlement Only";
  if (status === "receipt_without_settlement") return "Receipt Only";
  return "Matched";
}

export function statusTone(status: string): "success" | "info" | "danger" {
  if (status === "unreceipted_settlement") return "danger";
  if (status === "receipt_without_settlement") return "info";
  return "success";
}

export function receiptStatus(receiptHash: string, ledger: LedgerEntry[]): LedgerEntry["status"] {
  const status = ledger.find((entry) => entry.receiptHash === receiptHash)?.status;
  return status ?? "receipt_without_settlement";
}
