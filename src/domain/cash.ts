import Decimal from "decimal.js";
import { z } from "zod";
import { InventoryError } from "./inventory";

// Enough significant digits for the product of all supported quantity/price inputs.
// Do not mutate decimal.js's process-global configuration.
export const FinancialDecimal = Decimal.clone({ precision: 48, rounding: Decimal.ROUND_HALF_UP });

export const currencySchema = z.string().regex(/^[A-Z]{3}$/).refine((value) =>
  value === "XTS" || Intl.supportedValuesOf("currency").includes(value), "INVALID_CURRENCY");
export const amountSchema = z.string().regex(/^\d{1,18}(\.\d{1,4})?$/)
  .transform((value) => new Decimal(value).toString());
export const commandKey = z.string().trim().min(1).max(128);
export const openingAmountSchema = amountSchema.optional();
export const openSessionSchema = z.object({ registerId: z.string().uuid(), openingAmount: openingAmountSchema, openingReason: z.string().trim().min(1).max(500).optional(), idempotencyKey: commandKey }).strict();
export const closeSessionSchema = z.object({ registerSessionId: z.string().uuid(), idempotencyKey: commandKey }).strict();
export const cashMovementSchema = z.object({
  registerSessionId: z.string().uuid(), type: z.enum(["CASH_IN", "CASH_OUT"]), amount: amountSchema,
  reason: z.string().trim().min(1).max(500), referenceId: z.string().trim().max(128).optional(), idempotencyKey: commandKey,
}).strict();
export const blindCloseSchema = z.object({
  registerSessionId: z.string().uuid(), countedCashAmount: amountSchema,
  reason: z.string().trim().min(1).max(500), idempotencyKey: commandKey,
}).strict();
export const policySchema = z.object({
  mode: z.enum(["DISABLED", "ALLOW_WITH_CAPS", "REQUIRE_SUPERVISOR"]),
  currency: currencySchema,
  maxSessionValue: amountSchema.refine((value) => new Decimal(value).gt(0), "POSITIVE_CAP_REQUIRED"),
  maxLineQuantity: z.string().regex(/^\d{1,15}(\.\d{1,3})?$/).default("10"),
  maxSessionQuantity: z.string().regex(/^\d{1,15}(\.\d{1,3})?$/).default("30"),
  maxVariantDailyQuantity: z.string().regex(/^\d{1,15}(\.\d{1,3})?$/).default("20"),
  reviewAfterDays: z.number().int().min(1).max(365).default(7),
}).strict().superRefine((value, context) => {
  for (const key of ["maxLineQuantity", "maxSessionQuantity", "maxVariantDailyQuantity"] as const)
    if (new Decimal(value[key]).lte(0)) context.addIssue({ code: "custom", message: "POSITIVE_CAP_REQUIRED", path: [key] });
});
export type PolicyInput = z.output<typeof policySchema>;

export function currencyPrecision(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
export function money(value: Decimal.Value, currency: string): string {
  const rounded = new Decimal(value).toDecimalPlaces(currencyPrecision(currency), Decimal.ROUND_HALF_UP);
  if (rounded.isNegative() || rounded.gt("999999999999999999.9999")) throw new InventoryError("AMOUNT_OUT_OF_RANGE");
  return rounded.toFixed(currencyPrecision(currency));
}
export function assertMoneyPrecision(value: string, currency: string): void {
  if (new Decimal(value).decimalPlaces() > currencyPrecision(currency)) throw new InventoryError("INVALID_MONEY_PRECISION");
}
