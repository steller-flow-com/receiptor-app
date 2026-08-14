import { describe, expect, it } from "vitest";
import { receiptToLedgerRows, toCsv } from "../src/ledger.js";

const receipt = {
  receiptHash: "a".repeat(64),
  payer: "Gpayer",
  payee: "Gpayee",
  asset: "Casset",
  amount: 100n,
  serviceId: "b".repeat(64),
  ts: 123n,
  status: "receipted" as const,
};

describe("double-entry ledger", () => {
  it("creates cash debit and revenue credit rows", () => {
    expect(receiptToLedgerRows(receipt)).toEqual([
      expect.objectContaining({ side: "debit", account: "cash", amount: 100n }),
      expect.objectContaining({ side: "credit", account: "revenue", amount: 100n }),
    ]);
  });

  it("exports stable CSV columns and bigint values", () => {
    const rows = receiptToLedgerRows(receipt);
    expect(toCsv(rows)).toBe(
      [
        "receipt_hash,payee,asset,amount,service_id,ts,side,account,status",
        `${"a".repeat(64)},Gpayee,Casset,100,${"b".repeat(64)},123,debit,cash,receipted`,
        `${"a".repeat(64)},Gpayee,Casset,100,${"b".repeat(64)},123,credit,revenue,receipted`,
      ].join("\n"),
    );
  });
});
