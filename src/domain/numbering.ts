import Decimal from "decimal.js";
import { z } from "zod";
import { FinancialDecimal, commandKey, currencySchema, currencyPrecision } from "./cash";
import { InventoryError } from "./inventory";

// Document numbering is internal and sequential: it carries no fiscal meaning.
// Sequences are independent per branch and document type, start at 1, and must
// stay gap-free. Fiscal emission stays out of scope (D-009 initial ticket).
export const documentTypes = ["SALE", "ANNULMENT", "RETURN"] as const;
export type DocumentType = (typeof documentTypes)[number];
export const documentTypeSchema = z.enum(documentTypes);

export const closureSchema = z.object({
  branchId: z.string().uuid(),
  currency: currencySchema,
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: commandKey,
}).strict();
export type ClosureInput = z.output<typeof closureSchema>;

export function assertContinuous(numbers: readonly (number | null | undefined)[]): { count: number; max: number } {
  if (numbers.some((value) => value === null || value === undefined)) throw new InventoryError("UNNUMBERED_DOCUMENTS");
  const values = numbers as readonly number[];
  if (new Set(values).size !== values.length) throw new InventoryError("DUPLICATE_DOCUMENT_NUMBER");
  if (values.length === 0) return { count: 0, max: 0 };
  if (Math.min(...values) !== 1 || Math.max(...values) !== values.length) throw new InventoryError("SEQUENCE_GAP");
  return { count: values.length, max: values.length };
}

export function reconcileDocumentTotals(documentNet: Decimal.Value, cashTotal: Decimal.Value, currency: string): string {
  // Signed comparison: unlike stored amounts, intermediate nets can dip below
  // zero when unexplained outflows exist, and that must report UNRECONCILED_CASH.
  const places = currencyPrecision(currency);
  const net = new FinancialDecimal(documentNet).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  const cash = new FinancialDecimal(cashTotal).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  if (!net.equals(cash)) throw new InventoryError("UNRECONCILED_CASH");
  return net.toFixed(places);
}
