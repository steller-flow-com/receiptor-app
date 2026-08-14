import { describe, expect, it } from "vitest";
import {
  InvalidAmountError,
  ReceiptExistsError,
  mapContractError,
} from "../src/contract.js";

describe("ReceiptLedger error mapping", () => {
  it("maps ReceiptExists failures", () => {
    expect(mapContractError(new Error("contract error: ReceiptExists"))).toBeInstanceOf(
      ReceiptExistsError,
    );
  });

  it("maps InvalidAmount failures", () => {
    expect(mapContractError(new Error("contract error: InvalidAmount"))).toBeInstanceOf(
      InvalidAmountError,
    );
  });

  it("preserves unknown errors", () => {
    const error = new Error("network unavailable");
    expect(mapContractError(error)).toBe(error);
  });
});
