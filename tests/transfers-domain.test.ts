import { describe, expect, it } from "vitest";
import { TransferError, transferHttpStatus, transferInputSchema } from "../src/domain/transfers";

describe("transfer input", () => {
  const base = {
    originBranchId: "11111111-1111-4111-8111-111111111111",
    destinationBranchId: "22222222-2222-4222-8222-222222222222",
    originLocationId: "33333333-3333-4333-8333-333333333333",
    destinationLocationId: "44444444-4444-4444-8444-444444444444",
    lines: [{ variantId: "55555555-5555-4555-8555-555555555555", quantity: "2" }],
    idempotencyKey: "transfer-1",
  };

  it("accepts an automatic transfer with positive quantities", () => {
    expect(transferInputSchema.parse(base).lines[0]?.quantity).toBe("2");
  });

  it("rejects transfers within the same branch", () => {
    expect(() => transferInputSchema.parse({ ...base, destinationBranchId: base.originBranchId })).toThrow();
  });

  it("rejects duplicate variant and lot lines", () => {
    expect(() => transferInputSchema.parse({
      ...base,
      lines: [base.lines[0], base.lines[0]],
    })).toThrow();
  });

  it("accepts an explicit lot and rejects malformed input", () => {
    expect(transferInputSchema.parse({ ...base, lines: [{ ...base.lines[0], lotId: "66666666-6666-4666-8666-666666666666" }] }).lines[0]?.lotId).toBeDefined();
    expect(() => transferInputSchema.parse({ ...base, reason: 3 })).toThrow();
  });

  it("rejects zero quantities and maps transfer errors", () => {
    expect(() => transferInputSchema.parse({
      ...base,
      lines: [{ ...base.lines[0], quantity: "0" }],
    })).toThrow();
    expect(transferHttpStatus(new TransferError("UNAUTHENTICATED"))).toBe(401);
    expect(transferHttpStatus(new TransferError("FORBIDDEN"))).toBe(403);
    expect(transferHttpStatus(new TransferError("NOT_FOUND"))).toBe(404);
    expect(transferHttpStatus(new TransferError("IDEMPOTENCY_CONFLICT"))).toBe(409);
    expect(transferHttpStatus(new TransferError("INSUFFICIENT_STOCK"))).toBe(409);
    expect(transferHttpStatus(new TransferError("INVALID_QUANTITY_PRECISION"))).toBe(400);
  });
});
