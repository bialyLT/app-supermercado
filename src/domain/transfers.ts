import Decimal from "decimal.js";
import { z } from "zod";
import { InventoryError, quantitySchema } from "./inventory";

const idempotencyKey = z.string().trim().min(1).max(128);

export const transferLineSchema = z.object({
  variantId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  quantity: quantitySchema,
}).strict();

export const transferInputSchema = z.object({
  originBranchId: z.string().uuid(),
  destinationBranchId: z.string().uuid(),
  originLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  lines: z.array(transferLineSchema).min(1).max(100),
  reason: z.string().trim().min(1).max(500).optional(),
  idempotencyKey,
}).strict().superRefine((value, context) => {
  if (value.originBranchId === value.destinationBranchId) {
    context.addIssue({ code: "custom", message: "TRANSFER_BRANCHES_MUST_DIFFER", path: ["destinationBranchId"] });
  }
  const keys = new Set(value.lines.map((line) => `${line.variantId}:${line.lotId ?? ""}`));
  if (keys.size !== value.lines.length) {
    context.addIssue({ code: "custom", message: "DUPLICATE_TRANSFER_LINE", path: ["lines"] });
  }
});

export type TransferInput = z.output<typeof transferInputSchema>;

export class TransferError extends Error {
  constructor(public readonly code: string, public readonly detail?: string) {
    super(code);
    this.name = "TransferError";
  }
}

export function transferHttpStatus(error: TransferError): number {
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "NOT_FOUND") return 404;
  if (["IDEMPOTENCY_CONFLICT", "INSUFFICIENT_STOCK"].includes(error.code)) return 409;
  return 400;
}

export function assertPositiveTransferQuantity(quantity: string): void {
  if (!new Decimal(quantity).gt(0)) throw new InventoryError("INVALID_QUANTITY");
}
