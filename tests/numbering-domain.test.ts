import { describe, expect, it } from "vitest";
import {
  assertContinuous,
  closureSchema,
  documentTypes,
  reconcileDocumentTotals,
} from "../src/domain/numbering";

describe("document numbering domain", () => {
  it("supports one independent sequence per branch and document type", () => {
    expect(documentTypes).toEqual(["SALE", "ANNULMENT", "RETURN"]);
  });

  it("accepts a continuous range starting at 1", () => {
    expect(assertContinuous([1, 2, 3])).toEqual({ count: 3, max: 3 });
  });

  it("accepts an empty scope with zero totals", () => {
    expect(assertContinuous([])).toEqual({ count: 0, max: 0 });
  });

  it("rejects gaps before any write", () => {
    expect(() => assertContinuous([1, 3])).toThrow("SEQUENCE_GAP");
  });

  it("rejects duplicates before any write", () => {
    expect(() => assertContinuous([1, 2, 2])).toThrow("DUPLICATE_DOCUMENT_NUMBER");
  });

  it("rejects ranges that do not start at 1", () => {
    expect(() => assertContinuous([2, 3])).toThrow("SEQUENCE_GAP");
  });

  it("rejects unnumbered legacy documents", () => {
    expect(() => assertContinuous([1, null, 3])).toThrow("UNNUMBERED_DOCUMENTS");
  });

  it("validates the documental closure input", () => {
    const input = closureSchema.parse({
      branchId: crypto.randomUUID(),
      currency: "XTS",
      reason: "Month-end documental closure",
      idempotencyKey: "close-1",
    });
    expect(input.reason).toBe("Month-end documental closure");
    expect(() =>
      closureSchema.parse({ branchId: crypto.randomUUID(), currency: "XTS", reason: "", idempotencyKey: "close-1" }),
    ).toThrow();
    expect(() =>
      closureSchema.parse({ branchId: crypto.randomUUID(), currency: "XXX", reason: "ok", idempotencyKey: "close-1" }),
    ).toThrow();
  });

  it("reconciles balanced document and cash totals", () => {
    expect(reconcileDocumentTotals("5.00", "5.00", "XTS")).toBe("5.00");
    expect(reconcileDocumentTotals("0", "0.00", "XTS")).toBe("0.00");
  });

  it("rejects unreconciled totals before any write", () => {
    expect(() => reconcileDocumentTotals("5.00", "4.00", "XTS")).toThrow("UNRECONCILED_CASH");
  });
});
