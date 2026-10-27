import { describe, expect, it } from "vitest";
import { paymentsSchema } from "../src/domain/payment";

describe("manual payment contract", () => {
  it("accepts the four methods and mixed allocations", () => {
    expect(paymentsSchema.parse([
      { method: "CASH", amount: "1" },
      { method: "TRANSFER", amount: "1" },
      { method: "CARD", amount: "1" },
      { method: "WALLET", amount: "1" },
    ])).toHaveLength(4);
  });

  it("rejects empty, non-positive, duplicate, and unknown payments", () => {
    expect(() => paymentsSchema.parse([])).toThrow();
    expect(() => paymentsSchema.parse([{ method: "CASH", amount: "0" }])).toThrow();
    expect(() => paymentsSchema.parse([{ method: "CASH", amount: "1" }, { method: "CASH", amount: "1" }])).toThrow("DUPLICATE_PAYMENT_METHOD");
    expect(() => paymentsSchema.parse([{ method: "CHECK", amount: "1" }])).toThrow();
  });
});
