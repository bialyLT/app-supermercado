import { z } from "zod";
import { saleSchema } from "./inventory";

export const pinSchema = z.string().regex(/^\d{6,12}$/);
export const setPinSchema = z.object({ pin: pinSchema }).strict();
export const approvalSchema = z.object({
  approverUserId: z.string().uuid(), pin: pinSchema,
  reason: z.string().trim().min(1).max(500),
  sale: saleSchema.omit({ approvalToken: true }),
}).strict();
export type ApprovalInput = z.output<typeof approvalSchema>;
export const approvalTtlMs = 90000;
export const pinLockMs = 15 * 60000;
export const maxPinFailures = 5;
