import Decimal from "decimal.js";
import { assertMoneyPrecision } from "../../domain/cash";
import { InventoryError } from "../../domain/inventory";
import {
  parseConfiguredWeighedBarcode,
  type SaleLineSourceSnapshot,
} from "../../domain/weighed-barcode";
import type { TransactionClient as Tx } from "./tenant-context";

export async function resolveWeighedBarcodeInTx(
  tx: Tx,
  tenantId: string,
  branchId: string | undefined,
  line: { variantId: string; unitPrice?: string; weighedBarcode: string },
  now: Date,
): Promise<{
  price: { amount: Decimal; currency: string };
  variant: { name: string; categoryId: string | null };
  categoryId: string | null;
  quantityPrecision: number;
  sourceSnapshot: SaleLineSourceSnapshot;
}> {
  const stored = await tx.weighedBarcodeConfig.findUnique({ where: { tenantId } });
  if (!stored) throw new InventoryError("WEIGHED_BARCODE_NOT_CONFIGURED");
  if (stored.mode !== "PRICE") throw new InventoryError("WEIGHED_BARCODE_MODE_UNSUPPORTED");

  let parsed;
  try {
    parsed = parseConfiguredWeighedBarcode(line.weighedBarcode, {
      prefix: stored.prefix,
      mode: stored.mode,
      variantDigits: stored.variantDigits,
      valueDigits: stored.valueDigits,
      valueScale: stored.valueScale,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INVALID_EAN13") throw new InventoryError("INVALID_EAN13");
      if (error.message === "EAN13_PREFIX_MISMATCH") throw new InventoryError("EAN13_PREFIX_MISMATCH");
      if (error.message === "INVALID_EAN13_CHECKSUM") throw new InventoryError("INVALID_EAN13_CHECKSUM");
      if (error.message === "INVALID_EAN13_LAYOUT") throw new InventoryError("INVALID_EAN13_LAYOUT");
      if (error.message === "WEIGHED_BARCODE_ZERO_PRICE") throw new InventoryError("WEIGHED_BARCODE_ZERO_PRICE");
    }
    throw error;
  }
  if (!parsed.amount || parsed.amount.isZero() || parsed.amount.isNegative()) {
    throw new InventoryError("WEIGHED_BARCODE_ZERO_PRICE");
  }

  const variant = await tx.productVariant.findFirst({
    where: { tenantId, sku: parsed.variantCode, active: true },
    include: { product: true },
  });
  if (!variant) throw new InventoryError("NOT_FOUND");
  if (variant.id !== line.variantId) throw new InventoryError("PRICE_MISMATCH");

  if (line.unitPrice !== undefined && !new Decimal(line.unitPrice).equals(parsed.amount)) {
    throw new InventoryError("PRICE_MISMATCH");
  }

  const price = await tx.price.findFirst({
    where: {
      tenantId,
      variantId: variant.id,
      channel: "RETAIL",
      validFrom: { lte: now },
      AND: [
        { OR: [{ validTo: null }, { validTo: { gt: now } }] },
        ...(branchId ? [{ OR: [{ branchId }, { branchId: null }] }] : [{ branchId: null }]),
      ],
    },
    orderBy: [{ branchId: { sort: "desc", nulls: "last" } }, { validFrom: "desc" }, { id: "asc" }],
  });
  if (!price?.currency) throw new InventoryError("PRICE_CURRENCY_REQUIRED");
  assertMoneyPrecision(price.amount.toString(), price.currency);

  if (!price.amount.equals(parsed.amount)) {
    throw new InventoryError("PRICE_MISMATCH");
  }

  const sourceSnapshot: SaleLineSourceSnapshot = {
    type: "WEIGHED_BARCODE",
    raw: line.weighedBarcode,
    prefix: stored.prefix,
    sku: parsed.variantCode,
    mode: stored.mode,
    variantDigits: stored.variantDigits,
    valueDigits: stored.valueDigits,
    valueScale: stored.valueScale,
    unitPrice: parsed.amount.toFixed(stored.valueScale),
  };

  return {
    price: { amount: new Decimal(price.amount.toString()), currency: price.currency },
    variant: { name: variant.name, categoryId: variant.product.categoryId },
    categoryId: variant.product.categoryId,
    quantityPrecision: variant.quantityPrecision,
    sourceSnapshot,
  };
}
