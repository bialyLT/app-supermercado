import Decimal from "decimal.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { money, assertMoneyPrecision, currencySchema, policySchema, cashMovementSchema, blindCloseSchema } from "../src/domain/cash";
import { httpStatus, InventoryError } from "../src/domain/inventory";

describe("currency-aware intake contracts", () => {
  it("rounds currency-specific lines HALF_UP without precision loss", () => {
    expect(money("1.005", "XTS")).toBe("1.01");
    expect(money("1.5", "JPY")).toBe("2");
    expect(money("1.0005", "KWD")).toBe("1.001");
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 1000000 }), { minLength: 1, maxLength: 20 }), (mils) => {
      const lines = mils.map((value) => money(new Decimal(value.toString()).div("1000"), "XTS"));
      const sum = lines.reduce((total, line) => total.plus(line), new Decimal(0));
      expect(money(sum, "XTS")).toBe(sum.toFixed(2));
      expect(sum.isFinite()).toBe(true);
    }), { numRuns: 200, seed: 20261026 });
  });
  it("rejects bad currencies, monetary precision, nonpositive caps and unsafe amounts", () => {
    expect(currencySchema.safeParse("XXX").success).toBe(false);
    expect(currencySchema.safeParse("XTS").success).toBe(true);
    expect(currencySchema.safeParse("JPY").success).toBe(true);
    expect(() => assertMoneyPrecision("1.001", "XTS")).toThrow("INVALID_MONEY_PRECISION");
    expect(() => assertMoneyPrecision("1.00", "XTS")).not.toThrow();
    expect(() => money("-1", "XTS")).toThrow("AMOUNT_OUT_OF_RANGE");
    expect(() => money("1000000000000000000", "XTS")).toThrow("AMOUNT_OUT_OF_RANGE");
    for (const values of [{ maxSessionValue: "0" }, { maxLineQuantity: "0" }, { maxSessionQuantity: "0" }, { maxVariantDailyQuantity: "0" }, { reviewAfterDays: 0 }])
      expect(policySchema.safeParse({ mode: "ALLOW_WITH_CAPS", currency: "XTS", maxSessionValue: "100", ...values }).success).toBe(false);
    expect(policySchema.parse({ mode: "ALLOW_WITH_CAPS", currency: "XTS", maxSessionValue: "100" }).maxLineQuantity).toBe("10");
  });
  it("validates append-only movement and blind-close contracts", () => {
    expect(cashMovementSchema.safeParse({ registerSessionId: crypto.randomUUID(), type: "CASH_IN", amount: "10", reason: "Deposit", idempotencyKey: "in-1" }).success).toBe(true);
    expect(cashMovementSchema.safeParse({ registerSessionId: crypto.randomUUID(), type: "CASH_OUT", amount: "-1", reason: "Invalid", idempotencyKey: "out-1" }).success).toBe(false);
    expect(blindCloseSchema.safeParse({ registerSessionId: crypto.randomUUID(), countedCashAmount: "10.00", reason: "Counted", idempotencyKey: "close-1" }).success).toBe(true);
    expect(blindCloseSchema.safeParse({ registerSessionId: crypto.randomUUID(), countedCashAmount: "-1", reason: "Invalid", idempotencyKey: "close-2" }).success).toBe(false);
  });

  it("maps supervisor and cash errors to stable status codes", () => {
    expect(httpStatus(new InventoryError("SUPERVISOR_PIN_LOCKED"))).toBe(429);
    expect(httpStatus(new InventoryError("SUPERVISOR_PIN_INVALID"))).toBe(403);
    expect(httpStatus(new InventoryError("SUPERVISOR_APPROVAL_EXPIRED"))).toBe(409);
    expect(httpStatus(new InventoryError("REGISTER_SESSION_REQUIRED"))).toBe(409);
  });
});
