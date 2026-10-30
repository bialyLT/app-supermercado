import { describe, expect, it } from "vitest";
import {
  calculatePurchaseTotals,
  directPurchaseReceiptInputSchema,
  PurchaseError,
  purchaseHttpStatus,
  supplierInputSchema,
} from "../src/domain/purchases";

describe("purchases domain logic", () => {
  it("calculates line totals and summary totals with rounded line taxes and discounts", () => {
    const lines = [
      {
        variantId: "00000000-0000-0000-0000-000000000001",
        quantity: "3",
        unitCost: "10.50",
        taxRate: "0.21",
      },
      {
        variantId: "00000000-0000-0000-0000-000000000002",
        quantity: "2",
        unitCost: "25.00",
        discountAmount: "5.00",
        taxAmount: "4.50",
      },
    ];

    const result = calculatePurchaseTotals({
      currency: "ARS",
      lines,
    });

    // Line 1: subtotal = 3 * 10.50 = 31.50, tax = 31.50 * 0.21 = 6.615 -> 6.62, total = 38.12
    // Line 2: subtotal = 2 * 25.00 = 50.00, discount = 5.00, tax = 4.50, total = 50.00 - 5.00 + 4.50 = 49.50
    // Total subtotal = 81.50, taxTotal = 11.12, discountTotal = 5.00, total = 87.62
    expect(result.subtotal).toBe("81.50");
    expect(result.taxTotal).toBe("11.12");
    expect(result.discountTotal).toBe("5.00");
    expect(result.total).toBe("87.62");
    expect(result.lines[0].subtotal).toBe("31.50");
    expect(result.lines[0].taxAmount).toBe("6.62");
    expect(result.lines[0].total).toBe("38.12");
    expect(result.lines[1].subtotal).toBe("50.00");
    expect(result.lines[1].taxAmount).toBe("4.50");
    expect(result.lines[1].discountAmount).toBe("5.00");
    expect(result.lines[1].total).toBe("49.50");
  });

  it("accepts valid explicit client totals that match server calculations", () => {
    const result = calculatePurchaseTotals({
      currency: "ARS",
      subtotal: "30.00",
      taxTotal: "6.30",
      discountTotal: "0.00",
      total: "36.30",
      lines: [
        {
          variantId: "00000000-0000-0000-0000-000000000001",
          quantity: "3",
          unitCost: "10.00",
          taxRate: "0.21",
        },
      ],
    });

    expect(result.total).toBe("36.30");
  });

  it("rejects mismatched client-provided subtotal or total", () => {
    expect(() =>
      calculatePurchaseTotals({
        currency: "ARS",
        subtotal: "99.00", // Mismatch
        lines: [
          {
            variantId: "a0000000-0000-4000-8000-000000000001",
            quantity: "1",
            unitCost: "10.00",
          },
        ],
      }),
    ).toThrowError("INVALID_TOTALS");

    expect(() =>
      calculatePurchaseTotals({
        currency: "ARS",
        total: "50.00", // Expected 10.00
        lines: [
          {
            variantId: "a0000000-0000-4000-8000-000000000001",
            quantity: "1",
            unitCost: "10.00",
          },
        ],
      }),
    ).toThrowError("INVALID_TOTALS");
  });

  it("rejects negative quantities, negative unit costs, and negative discounts/taxes", () => {
    expect(() =>
      calculatePurchaseTotals({
        currency: "ARS",
        lines: [
          {
            variantId: "a0000000-0000-4000-8000-000000000001",
            quantity: "-1",
            unitCost: "10.00",
          },
        ],
      }),
    ).toThrowError("INVALID_INPUT");

    expect(() =>
      calculatePurchaseTotals({
        currency: "ARS",
        lines: [
          {
            variantId: "a0000000-0000-4000-8000-000000000001",
            quantity: "1",
            unitCost: "-5.00",
          },
        ],
      }),
    ).toThrowError("INVALID_INPUT");

    expect(() =>
      calculatePurchaseTotals({
        currency: "ARS",
        discountTotal: "-1.00",
        lines: [
          {
            variantId: "a0000000-0000-4000-8000-000000000001",
            quantity: "1",
            unitCost: "10.00",
          },
        ],
      }),
    ).toThrowError("INVALID_INPUT");
  });

  it("validates direct purchase receipt input schema", () => {
    const valid = {
      supplierId: "a0000000-0000-4000-8000-000000000001",
      branchId: "a0000000-0000-4000-8000-000000000002",
      locationId: "a0000000-0000-4000-8000-000000000003",
      receiptNumber: "REC-2026-001",
      currency: "ARS",
      idempotencyKey: "idem-rec-1",
      lines: [
        {
          variantId: "a0000000-0000-4000-8000-000000000004",
          quantity: "10",
          unitCost: "5.25",
        },
      ],
    };

    const parsed = directPurchaseReceiptInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);

    // Empty lines rejected
    expect(
      directPurchaseReceiptInputSchema.safeParse({ ...valid, lines: [] }).success,
    ).toBe(false);

    // Missing supplierId rejected
    expect(
      directPurchaseReceiptInputSchema.safeParse({ ...valid, supplierId: undefined }).success,
    ).toBe(false);

    // Empty idempotencyKey rejected
    expect(
      directPurchaseReceiptInputSchema.safeParse({ ...valid, idempotencyKey: "" }).success,
    ).toBe(false);
  });

  it("validates supplier input schema", () => {
    const validSupplier = {
      code: "PROV-001",
      name: "Distribuidora Mayorista SA",
      taxId: "30-11223344-5",
      email: "ventas@mayorista.test",
    };

    expect(supplierInputSchema.safeParse(validSupplier).success).toBe(true);
    expect(supplierInputSchema.safeParse({ ...validSupplier, code: "" }).success).toBe(false);
    expect(supplierInputSchema.safeParse({ ...validSupplier, name: "" }).success).toBe(false);
  });

  it("rejects mismatched tax and discount totals and invalid line tax inputs", () => {
    const line = { variantId: "a0000000-0000-4000-8000-000000000001", quantity: "1", unitCost: "10.00", taxRate: "0.21", discountAmount: "1.00" };
    expect(() => calculatePurchaseTotals({ currency: "ARS", discountTotal: "2.00", lines: [line] })).toThrowError("INVALID_TOTALS");
    expect(() => calculatePurchaseTotals({ currency: "ARS", taxTotal: "1.00", lines: [line] })).toThrowError("INVALID_TOTALS");
    expect(() => calculatePurchaseTotals({ currency: "ARS", lines: [{ ...line, taxRate: "-0.1" }] })).toThrowError();
    expect(() => calculatePurchaseTotals({ currency: "ARS", lines: [{ ...line, taxAmount: "-1.00", taxRate: undefined }] })).toThrowError();
    expect(() => calculatePurchaseTotals({ currency: "ARS", lines: [{ ...line, discountAmount: "11.00", taxRate: undefined }] })).toThrowError();
  });

  it("maps domain error codes to correct HTTP status codes", () => {
    expect(purchaseHttpStatus(new PurchaseError("UNAUTHENTICATED"))).toBe(401);
    expect(purchaseHttpStatus(new PurchaseError("FORBIDDEN"))).toBe(403);
    expect(purchaseHttpStatus(new PurchaseError("NOT_FOUND"))).toBe(404);
    expect(purchaseHttpStatus(new PurchaseError("IDEMPOTENCY_CONFLICT"))).toBe(409);
    expect(purchaseHttpStatus(new PurchaseError("INVALID_TOTALS"))).toBe(400);
    expect(purchaseHttpStatus(new PurchaseError("INVALID_INPUT"))).toBe(400);
    expect(purchaseHttpStatus(new PurchaseError("INVALID_QUANTITY_PRECISION"))).toBe(400);
    expect(purchaseHttpStatus(new PurchaseError("CURRENCY_MISMATCH"))).toBe(409);
    expect(purchaseHttpStatus(new PurchaseError("MONETARY_CONFIGURATION_REQUIRED"))).toBe(400);
    expect(purchaseHttpStatus(new PurchaseError("TENANT_ACCESS_DENIED"))).toBe(404);
  });
});
