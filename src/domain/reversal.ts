import Decimal from "decimal.js";
import { z } from "zod";
import { amountSchema, commandKey, currencySchema } from "./cash";
import { InventoryError, quantitySchema } from "./inventory";

const lineSchema = z.object({ saleLineId: z.string().uuid(), quantity: quantitySchema }).strict();
export const reversalSchema = z.object({
  saleId: z.string().uuid(),
  type: z.enum(["ANNULMENT", "RETURN"]),
  lines: z.array(lineSchema).min(1).max(100),
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: commandKey,
}).strict().superRefine((value, context) => {
  if (new Set(value.lines.map((line) => line.saleLineId)).size !== value.lines.length)
    context.addIssue({ code: "custom", message: "DUPLICATE_REVERSAL_LINE", path: ["lines"] });
});
export type ReversalInput = z.output<typeof reversalSchema>;
export type ReversalType = ReversalInput["type"];

export function reversalLineTotal(quantity: string, unitPrice: string, currency: string): string {
  const places = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Decimal(quantity).times(unitPrice).toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places);
}

export function assertReversalCurrency(currency: string, expected: string): void {
  if (!currencySchema.safeParse(currency).success || currency !== expected) throw new InventoryError("CURRENCY_MISMATCH");
}

export const reversalAmountSchema = amountSchema;
