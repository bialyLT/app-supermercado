import { z } from "zod";

const uuid = z.string().uuid();

export const operationsReportQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  branchId: uuid.optional(),
  actorUserId: uuid.optional(),
  variantId: uuid.optional(),
  categoryId: uuid.optional(),
  format: z.enum(["json", "csv"]).default("json"),
}).strict().superRefine((value, context) => {
  if (Date.parse(value.to) <= Date.parse(value.from)) {
    context.addIssue({ code: "custom", message: "REPORT_PERIOD_MUST_ASCEND", path: ["to"] });
  }
});

export type OperationsReportQuery = z.output<typeof operationsReportQuerySchema>;

export class ReportError extends Error {
  constructor(public readonly code: string, public readonly detail?: string) {
    super(code);
    this.name = "ReportError";
  }
}

export function reportHttpStatus(error: ReportError): number {
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "INVALID_PERIOD") return 400;
  return 400;
}
