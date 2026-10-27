import { z } from "zod";

export const fiscalConditionSchema = z.enum(["MONOTRIBUTO", "RESPONSABLE_INSCRIPTO"]);
export const fiscalCountrySchema = z.literal("AR");
export const fiscalSnapshotVersion = 1;
export const fiscalSnapshotSchema = z.object({
  version: z.literal(fiscalSnapshotVersion),
  storeId: z.string().uuid(),
  storeName: z.string().trim().min(1).max(120),
  country: fiscalCountrySchema,
  condition: fiscalConditionSchema,
  internalTicket: z.literal(true),
}).strict();
export const fiscalProfileSchema = z.object({
  storeId: z.string().uuid(),
  condition: fiscalConditionSchema,
  internalTicket: z.literal(true),
}).strict();

export type FiscalCondition = z.infer<typeof fiscalConditionSchema>;
export type FiscalCountry = z.infer<typeof fiscalCountrySchema>;
export type FiscalContext = Readonly<{
  storeId: string;
  storeName: string;
  country: string;
  condition: FiscalCondition;
  internalTicket: boolean;
}>;
export type FiscalSnapshot = z.infer<typeof fiscalSnapshotSchema>;
export type FiscalProfileInput = z.infer<typeof fiscalProfileSchema>;

export class FiscalError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export function httpStatus(error: FiscalError): number {
  switch (error.code) {
    case "FISCAL_COUNTRY_UNSUPPORTED":
    case "FISCAL_CONDITION_UNSUPPORTED":
    case "FISCAL_SNAPSHOT_INVALID":
    case "FISCAL_CONTEXT_REQUIRED":
      return 400;
    default:
      return 500;
  }
}

export function buildFiscalContext(context: FiscalContext): FiscalContext {
  if (!fiscalCountrySchema.safeParse(context.country).success) throw new FiscalError("FISCAL_COUNTRY_UNSUPPORTED");
  if (!fiscalConditionSchema.safeParse(context.condition).success) throw new FiscalError("FISCAL_CONDITION_UNSUPPORTED");
  if (context.internalTicket !== true) throw new FiscalError("FISCAL_CONTEXT_REQUIRED");
  if (context.storeId.trim().length === 0 || context.storeName.trim().length === 0) throw new FiscalError("FISCAL_CONTEXT_REQUIRED");
  return context;
}

export function buildFiscalSnapshot(context: FiscalContext): FiscalSnapshot {
  const parsed = fiscalSnapshotSchema.safeParse({ version: fiscalSnapshotVersion, ...context });
  if (!parsed.success) throw new FiscalError("FISCAL_SNAPSHOT_INVALID");
  return parsed.data;
}
