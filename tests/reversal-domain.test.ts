import { describe, expect, it } from "vitest";
import { reversalSchema } from "../src/domain/reversal";

describe("sale reversal contract", () => {
  it("requires a reason, idempotency key, and unique lines", () => {
    expect(() => reversalSchema.parse({ saleId: crypto.randomUUID(), type: "RETURN", lines: [], reason: "", idempotencyKey: "" })).toThrow();
    const saleLineId = crypto.randomUUID();
    expect(() => reversalSchema.parse({ saleId: crypto.randomUUID(), type: "RETURN", lines: [{ saleLineId, quantity: "1" }, { saleLineId, quantity: "1" }], reason: "Customer return", idempotencyKey: "reverse-1" })).toThrow("DUPLICATE_REVERSAL_LINE");
  });

  it("accepts only the bounded document types", () => {
    const input = reversalSchema.parse({ saleId: crypto.randomUUID(), type: "ANNULMENT", lines: [{ saleLineId: crypto.randomUUID(), quantity: "2" }], reason: "Full annulment", idempotencyKey: "reverse-2" });
    expect(input.type).toBe("ANNULMENT");
  });
});
