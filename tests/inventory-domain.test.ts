import Decimal from "decimal.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { httpStatus, InventoryError, multiSaleSchema, quantitySchema, reviewSchema } from "../src/domain/inventory";
import { parseWeighedEan13 } from "../src/domain/ean13";
import { selectFefoLots } from "../src/domain/fefo";

describe("inventory contracts and decimal properties", () => {
  it("maps typed errors to stable HTTP statuses", () => {
    for (const [code, status] of [["NOT_FOUND", 404], ["UNAUTHENTICATED", 401], ["FORBIDDEN", 403], ["SEPARATION_OF_DUTIES", 403], ["IDEMPOTENCY_CONFLICT", 409], ["REVIEW_ALREADY_CLOSED", 409], ["INSUFFICIENT_STOCK", 409], ["EXPIRED_LOT", 400]] as const)
      expect(httpStatus(new InventoryError(code))).toBe(status);
  });

  it("normalizes exact quantities and rejects out-of-contract values", () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 99999999 }), (millis) => {
      const quantity = new Decimal(millis.toString()).div("1000");
      const parsed = quantitySchema.parse(quantity.toFixed(3));
      expect(new Decimal(parsed).times("1000").toString()).toBe(millis.toString());
    }), { numRuns: 200, seed: 20261026 });
    for (const input of ["0", "-1", "1.0001", "NaN", "Infinity", "1e3"]) expect(quantitySchema.safeParse(input).success).toBe(false);
  });

  it("parses weighed labels without loss of precision", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 99999 }), (value) => {
      const body = `2012345${value.toString().padStart(5, "0")}`;
      const sum = [...body].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
      const raw = `${body}${(10 - sum % 10) % 10}`;
      const config = { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 } as const;
      expect(parseWeighedEan13(raw, config).amount?.toFixed(2)).toBe(new Decimal(value.toString()).div("100").toFixed(2));
      expect(() => parseWeighedEan13(raw, { ...config, valueDigits: 20 })).toThrow("INVALID_EAN13_LAYOUT");
    }), { numRuns: 200, seed: 20261026 });
  });

  it("rejects multiline sales with duplicate variants or different locations", () => {
    const line = { locationId: "123e4567-e89b-42d3-a456-426614174000", variantId: "123e4567-e89b-42d3-a456-426614174001", quantity: "1" };
    expect(multiSaleSchema.safeParse({ lines: [line, line], idempotencyKey: "sale" }).success).toBe(false);
    expect(multiSaleSchema.safeParse({ lines: [line, { ...line, variantId: "123e4567-e89b-42d3-a456-426614174002", locationId: "123e4567-e89b-42d3-a456-426614174003" }], idempotencyKey: "sale" }).success).toBe(false);
  });

  it("normalizes multiline commands without trusting client prices", () => {
    const parsed = multiSaleSchema.parse({ lines: [{ locationId: "123e4567-e89b-42d3-a456-426614174000", variantId: "123e4567-e89b-42d3-a456-426614174001", quantity: "1", unitPrice: "999.999" }], idempotencyKey: "sale" });
    expect(parsed.lines[0].unitPrice).toBe("999.999");
  });

  it("requires complete review decisions", () => {
    const base = { reviewId: "123e4567-e89b-42d3-a456-426614174000", reason: "verify", idempotencyKey: "key" };
    expect(reviewSchema.safeParse({ ...base, decision: "CONFIRMED" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, decision: "CORRECTED" }).success).toBe(false);
    expect(reviewSchema.safeParse({ ...base, decision: "REJECTED" }).success).toBe(true);
  });

  it("handles empty, undated, exhausted and split lots without creating quantities", () => {
    const now = new Date("2026-10-26T00:00:00Z");
    const lots = [
      { lotId: "undated", expiresAt: null, available: new Decimal("1") },
      { lotId: "early", expiresAt: new Date("2027-01-01"), available: new Decimal("1") },
      { lotId: "empty", expiresAt: new Date("2027-02-01"), available: new Decimal("0") },
    ];
    const selected = selectFefoLots(lots, new Decimal("2"), now);
    expect(selected.map((lot) => lot.lotId)).toEqual(["early", "undated"]);
    expect(() => selectFefoLots(lots, new Decimal("0"), now)).toThrow("INVALID_QUANTITY");
    expect(() => selectFefoLots(lots, new Decimal("3"), now)).toThrow("INSUFFICIENT_STOCK");
    expect(() => selectFefoLots([], new Decimal("1"), now)).toThrow("INSUFFICIENT_STOCK");
    const undated = [lots[0], { ...lots[0], lotId: "second" }];
    expect(selectFefoLots(undated, new Decimal("2"), now)).toHaveLength(2);
  });
});
