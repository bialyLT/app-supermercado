import { z } from "zod";
import { parseWeighedEan13, type Ean13Config } from "./ean13";

export const weighedBarcodeConfigSchema = z.object({
  prefix: z.string().regex(/^\d+$/).min(1).max(6),
  mode: z.enum(["PRICE", "WEIGHT"]),
  variantDigits: z.number().int().positive().max(10),
  valueDigits: z.number().int().positive().max(10),
  valueScale: z.number().int().min(0).max(6),
}).strict().superRefine((value, context) => {
  if (value.prefix.length + value.variantDigits + value.valueDigits !== 12) {
    context.addIssue({ code: "custom", message: "INVALID_EAN13_LAYOUT", path: ["variantDigits"] });
  }
});

export type WeighedBarcodeConfigInput = z.infer<typeof weighedBarcodeConfigSchema>;

export const saleLineSourceSnapshotSchema = z.object({
  type: z.literal("WEIGHED_BARCODE"),
  raw: z.string(),
  prefix: z.string(),
  sku: z.string(),
  mode: z.enum(["PRICE", "WEIGHT"]),
  variantDigits: z.number(),
  valueDigits: z.number(),
  valueScale: z.number(),
  unitPrice: z.string(),
}).strict();

export type SaleLineSourceSnapshot = z.infer<typeof saleLineSourceSnapshotSchema>;

export function parseConfiguredWeighedBarcode(raw: string, input: WeighedBarcodeConfigInput) {
  if (input.prefix.length + input.variantDigits + input.valueDigits !== 12 || !/^\d+$/.test(input.prefix)) {
    throw new Error("INVALID_EAN13_LAYOUT");
  }
  const config: Ean13Config = input;
  const parsed = parseWeighedEan13(raw, config);
  if (input.mode === "PRICE" && parsed.amount && (parsed.amount.isZero() || parsed.amount.isNegative())) {
    throw new Error("WEIGHED_BARCODE_ZERO_PRICE");
  }
  return parsed;
}
