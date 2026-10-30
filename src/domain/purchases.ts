import Decimal from "decimal.js";
import { z } from "zod";
import { FinancialDecimal, currencyPrecision, currencySchema, money } from "./cash";

export type PurchaseErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_INPUT"
  | "INVALID_TOTALS"
  | "INVALID_QUANTITY_PRECISION"
  | "CURRENCY_MISMATCH"
  | "MONETARY_CONFIGURATION_REQUIRED"
  | "TENANT_ACCESS_DENIED";

export class PurchaseError extends Error {
  constructor(readonly code: PurchaseErrorCode, readonly detail?: string) {
    super(code);
    this.name = "PurchaseError";
  }
}

export function purchaseHttpStatus(error: PurchaseError): number {
  switch (error.code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "IDEMPOTENCY_CONFLICT":
    case "CURRENCY_MISMATCH":
      return 409;
    case "INVALID_TOTALS":
    case "INVALID_INPUT":
    case "INVALID_QUANTITY_PRECISION":
      return 400;
    case "TENANT_ACCESS_DENIED":
      return 404; // defense in depth: never reveal other tenant's resources
    default:
      return 400;
  }
}

export const supplierInputSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(200),
    taxId: z.string().trim().max(64).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(50).optional(),
    address: z.string().trim().max(255).optional(),
    active: z.boolean().default(true),
  })
  .strict();

export type SupplierInput = z.input<typeof supplierInputSchema>;
export type SupplierOutput = z.output<typeof supplierInputSchema>;

export const purchaseLineInputSchema = z
  .object({
    variantId: z.string().uuid(),
    lotId: z.string().uuid().optional(),
    lotNumber: z.string().trim().min(1).max(100).optional(),
    expiresAt: z.string().datetime().optional(),
    quantity: z
      .string()
      .regex(/^\d{1,15}(\.\d{1,6})?$/)
      .refine((q) => new Decimal(q).gt(0), "QUANTITY_MUST_BE_POSITIVE"),
    unitCost: z
      .string()
      .regex(/^\d{1,18}(\.\d{1,4})?$/)
      .refine((c) => new Decimal(c).gte(0), "UNIT_COST_NON_NEGATIVE"),
    taxRate: z
      .string()
      .regex(/^\d{1,3}(\.\d{1,4})?$/)
      .optional(),
    taxAmount: z
      .string()
      .regex(/^\d{1,18}(\.\d{1,4})?$/)
      .optional(),
    discountAmount: z
      .string()
      .regex(/^\d{1,18}(\.\d{1,4})?$/)
      .optional(),
  })
  .strict();

export type PurchaseLineInput = z.infer<typeof purchaseLineInputSchema>;

export const directPurchaseReceiptInputSchema = z
  .object({
    supplierId: z.string().uuid(),
    branchId: z.string().uuid(),
    locationId: z.string().uuid(),
    issuedAt: z.string().datetime().optional(),
    receiptNumber: z.string().trim().min(1).max(100).optional(),
    currency: currencySchema,
    subtotal: z
      .string()
      .regex(/^\d{1,18}(\.\d{1,4})?$/)
      .optional(),
    taxTotal: z
      .string()
      .regex(/^\d{1,18}(\.\d{1,4})?$/)
      .optional(),
    discountTotal: z
      .string()
      .regex(/^\d{1,18}(\.\d{1,4})?$/)
      .optional(),
    total: z
      .string()
      .regex(/^\d{1,18}(\.\d{1,4})?$/)
      .optional(),
    lines: z.array(purchaseLineInputSchema).min(1, "AT_LEAST_ONE_LINE_REQUIRED"),
    notes: z.string().trim().max(1000).optional(),
    idempotencyKey: z.string().trim().min(1).max(128),
  })
  .strict();

export type DirectPurchaseReceiptInput = z.input<typeof directPurchaseReceiptInputSchema>;
export type DirectPurchaseReceiptOutput = z.output<typeof directPurchaseReceiptInputSchema>;

export type CalculatedLine = {
  variantId: string;
  lotId?: string;
  lotNumber?: string;
  expiresAt?: string;
  quantity: string;
  unitCost: string;
  taxRate?: string;
  taxAmount: string;
  discountAmount: string;
  subtotal: string;
  total: string;
};

export type CalculatedPurchaseTotals = {
  currency: string;
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  total: string;
  lines: CalculatedLine[];
};

export function calculatePurchaseTotals(input: {
  currency: string;
  subtotal?: string;
  taxTotal?: string;
  discountTotal?: string;
  total?: string;
  lines: Array<{
    variantId: string;
    lotId?: string;
    lotNumber?: string;
    expiresAt?: string;
    quantity: string;
    unitCost: string;
    taxRate?: string;
    taxAmount?: string;
    discountAmount?: string;
  }>;
}): CalculatedPurchaseTotals {
  const currency = input.currency;
  const decimals = currencyPrecision(currency);

  if (input.lines.length === 0) {
    throw new PurchaseError("INVALID_INPUT", "Receipt must contain at least one line");
  }

  if (input.discountTotal && new Decimal(input.discountTotal).isNegative()) {
    throw new PurchaseError("INVALID_INPUT", "Discount total cannot be negative");
  }

  if (input.taxTotal && new Decimal(input.taxTotal).isNegative()) {
    throw new PurchaseError("INVALID_INPUT", "Tax total cannot be negative");
  }

  let computedSubtotal = new FinancialDecimal(0);
  let computedLineDiscountTotal = new FinancialDecimal(0);
  let computedLineTaxTotal = new FinancialDecimal(0);

  const calculatedLines: CalculatedLine[] = input.lines.map((line) => {
    const qty = new Decimal(line.quantity);
    const cost = new Decimal(line.unitCost);

    if (qty.lte(0)) {
      throw new PurchaseError("INVALID_INPUT", "Quantity must be positive");
    }
    if (cost.isNegative()) {
      throw new PurchaseError("INVALID_INPUT", "Unit cost cannot be negative");
    }

    const lineSubtotalDec = new FinancialDecimal(qty).times(cost).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    const lineDiscountDec = line.discountAmount
      ? new FinancialDecimal(line.discountAmount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
      : new FinancialDecimal(0);

    if (lineDiscountDec.isNegative() || lineDiscountDec.gt(lineSubtotalDec)) {
      throw new PurchaseError("INVALID_INPUT", "Line discount must be non-negative and not exceed subtotal");
    }

    const taxableAmount = lineSubtotalDec.minus(lineDiscountDec);

    let lineTaxDec = new FinancialDecimal(0);
    if (line.taxAmount !== undefined) {
      lineTaxDec = new FinancialDecimal(line.taxAmount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
      if (lineTaxDec.isNegative()) {
        throw new PurchaseError("INVALID_INPUT", "Line tax cannot be negative");
      }
    } else if (line.taxRate !== undefined) {
      const rate = new FinancialDecimal(line.taxRate);
      if (rate.isNegative()) {
        throw new PurchaseError("INVALID_INPUT", "Tax rate cannot be negative");
      }
      lineTaxDec = taxableAmount.times(rate).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    }

    const lineTotalDec = taxableAmount.plus(lineTaxDec);

    computedSubtotal = computedSubtotal.plus(lineSubtotalDec);
    computedLineDiscountTotal = computedLineDiscountTotal.plus(lineDiscountDec);
    computedLineTaxTotal = computedLineTaxTotal.plus(lineTaxDec);

    return {
      variantId: line.variantId,
      lotId: line.lotId,
      lotNumber: line.lotNumber,
      expiresAt: line.expiresAt,
      quantity: line.quantity,
      unitCost: cost.toFixed(decimals > 2 ? decimals : 2),
      taxRate: line.taxRate,
      taxAmount: lineTaxDec.toFixed(decimals),
      discountAmount: lineDiscountDec.toFixed(decimals),
      subtotal: lineSubtotalDec.toFixed(decimals),
      total: lineTotalDec.toFixed(decimals),
    };
  });

  // Verify or resolve discountTotal
  let finalDiscountDec = computedLineDiscountTotal;
  if (input.discountTotal !== undefined) {
    const inputDiscount = new FinancialDecimal(input.discountTotal).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    if (computedLineDiscountTotal.gt(0) && !inputDiscount.equals(computedLineDiscountTotal)) {
      throw new PurchaseError("INVALID_TOTALS", "Discount total mismatch with lines");
    }
    finalDiscountDec = inputDiscount;
  }

  // Verify or resolve taxTotal
  let finalTaxDec = computedLineTaxTotal;
  if (input.taxTotal !== undefined) {
    const inputTax = new FinancialDecimal(input.taxTotal).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    if (computedLineTaxTotal.gt(0) && !inputTax.equals(computedLineTaxTotal)) {
      throw new PurchaseError("INVALID_TOTALS", "Tax total mismatch with lines");
    }
    finalTaxDec = inputTax;
  }

  // Header subtotal check
  if (input.subtotal !== undefined) {
    const inputSubtotal = new FinancialDecimal(input.subtotal).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    if (!computedSubtotal.equals(inputSubtotal)) {
      throw new PurchaseError("INVALID_TOTALS", "Subtotal does not match line items");
    }
  }

  const computedTotal = computedSubtotal.minus(finalDiscountDec).plus(finalTaxDec);
  if (computedTotal.isNegative()) {
    throw new PurchaseError("INVALID_TOTALS", "Total cannot be negative");
  }

  if (input.total !== undefined) {
    const inputTotal = new FinancialDecimal(input.total).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
    if (!computedTotal.equals(inputTotal)) {
      throw new PurchaseError("INVALID_TOTALS", "Total does not match calculated total");
    }
  }

  return {
    currency,
    subtotal: money(computedSubtotal, currency),
    taxTotal: money(finalTaxDec, currency),
    discountTotal: money(finalDiscountDec, currency),
    total: money(computedTotal, currency),
    lines: calculatedLines,
  };
}
