import Decimal from "decimal.js";
import { z } from "zod";

export const paymentMethods = ["CASH", "TRANSFER", "CARD", "WALLET"] as const;
export const paymentMethodSchema = z.enum(paymentMethods);
const paymentAmountSchema = z.string().regex(/^\d{1,18}(\.\d{1,4})?$/)
  .refine((value) => new Decimal(value).gt(0), "POSITIVE_PAYMENT_REQUIRED")
  .transform((value) => new Decimal(value).toString());

export const paymentSchema = z.object({ method: paymentMethodSchema, amount: paymentAmountSchema }).strict();
export const paymentsSchema = z.array(paymentSchema).min(1, "PAYMENT_REQUIRED").max(4, "TOO_MANY_PAYMENTS")
  .superRefine((payments, context) => {
    const methods = new Set<string>();
    for (const [index, payment] of payments.entries()) {
      if (methods.has(payment.method)) context.addIssue({ code: "custom", message: "DUPLICATE_PAYMENT_METHOD", path: [index, "method"] });
      methods.add(payment.method);
    }
  });
export type PaymentInput = z.output<typeof paymentSchema>;
export type PaymentMethod = (typeof paymentMethods)[number];
