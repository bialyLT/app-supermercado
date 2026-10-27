import Decimal from "decimal.js";
import { z } from "zod";
import { paymentsSchema } from "./payment";

export class InventoryError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export const quantitySchema = z.string().regex(/^\d{1,15}(\.\d{1,3})?$/)
  .refine((value) => new Decimal(value).greaterThan(0), "INVALID_QUANTITY")
  .transform((value) => new Decimal(value).toString());
const key = z.string().trim().min(1).max(128);
const stock = {
  locationId: z.string().uuid(), variantId: z.string().uuid(), lotId: z.string().uuid().optional(),
  quantity: quantitySchema, idempotencyKey: key,
};
export const receiptSchema = z.object({ ...stock, reason: z.string().trim().min(1).max(500) }).strict();
const priceSchema = z.string().regex(/^\d{1,18}(\.\d{1,4})?$/).transform((value) => {
  const decimal = new Decimal(value);
  return decimal.decimalPlaces() <= 2 ? decimal.toFixed(2) : decimal.toString();
});
const saleOptions = {
  reason: z.string().trim().min(1).max(500).optional(),
  allowUnverifiedIntake: z.boolean().default(false),
  approvalToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
};
export const saleSchema = z.object({ ...stock, unitPrice: priceSchema, ...saleOptions }).strict();
const multiSaleLineSchema = z.object({ locationId: stock.locationId, variantId: stock.variantId, lotId: stock.lotId,
  quantity: stock.quantity, unitPrice: priceSchema.optional(), reason: saleOptions.reason }).strict();
export const multiSaleSchema = z.object({
  lines: z.array(multiSaleLineSchema).min(1).max(100),
  allowUnverifiedIntake: z.boolean().default(false),
  approvalToken: saleOptions.approvalToken,
  idempotencyKey: key,
}).strict().superRefine((value, context) => {
  const locations = new Set(value.lines.map((line) => line.locationId));
  if (locations.size !== 1) context.addIssue({ code: "custom", message: "SAME_LOCATION_REQUIRED", path: ["lines"] });
  const variants = new Set(value.lines.map((line) => `${line.locationId}:${line.variantId}`));
  if (variants.size !== value.lines.length) context.addIssue({ code: "custom", message: "DUPLICATE_VARIANT_LINE", path: ["lines"] });
});
export const paidMultiSaleSchema = multiSaleSchema.extend({ payments: paymentsSchema });
export const reservationSchema = z.object({ ...stock, referenceId: z.string().max(128).optional() }).strict();
export const releaseSchema = z.object({ reservationId: z.string().uuid(), idempotencyKey: key }).strict();
export const reviewSchema = z.object({
  reviewId: z.string().uuid(), decision: z.enum(["CONFIRMED", "CORRECTED", "REJECTED"]),
  reason: z.string().trim().min(1).max(500), idempotencyKey: key,
  correctionQuantity: z.string().regex(/^\d{1,15}(\.\d{1,3})?$/).optional(),
  unitCost: z.string().regex(/^\d{1,15}(\.\d{1,2})?$/).optional(),
  acknowledgeUnknownCost: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.decision === "CORRECTED" && value.correctionQuantity === undefined)
    context.addIssue({ code: "custom", message: "CORRECTION_REQUIRED" });
  if (value.decision === "CONFIRMED" && value.unitCost === undefined && value.acknowledgeUnknownCost !== true)
    context.addIssue({ code: "custom", message: "COST_ACKNOWLEDGEMENT_REQUIRED" });
});
export type Receipt = z.output<typeof receiptSchema>;
export type SaleInput = z.output<typeof saleSchema>;
export type MultiSaleInput = z.output<typeof multiSaleSchema>;
export type PaidMultiSaleInput = z.output<typeof paidMultiSaleSchema>;
export type ReservationInput = z.output<typeof reservationSchema>;
export type ReviewInput = z.output<typeof reviewSchema>;

export function assertQuantityPrecision(quantity: string, precision: number): void {
  if (new Decimal(quantity).decimalPlaces() > precision) throw new InventoryError("INVALID_QUANTITY_PRECISION");
}

export function httpStatus(error: InventoryError): number {
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "SUPERVISOR_PIN_LOCKED") return 429;
  if (["FORBIDDEN", "SEPARATION_OF_DUTIES", "SUPERVISOR_PIN_INVALID", "INVALID_SUPERVISOR_APPROVAL"].includes(error.code)) return 403;
  if (["IDEMPOTENCY_CONFLICT", "REVIEW_ALREADY_CLOSED", "INSUFFICIENT_STOCK", "SUPERVISOR_APPROVAL_USED", "SUPERVISOR_APPROVAL_EXPIRED",
    "REGISTER_SESSION_REQUIRED", "REGISTER_SESSION_ALREADY_OPEN", "REGISTER_SESSION_ALREADY_CLOSED", "MONETARY_CONFIGURATION_REQUIRED", "CURRENCY_MISMATCH", "PRICE_MISMATCH", "PAYMENT_TOTAL_MISMATCH"].includes(error.code)) return 409;
  return 400;
}
