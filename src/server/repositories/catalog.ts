import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "../../domain/actor";
import { inventoryTransaction, systemClock } from "./inventory";
import { currencySchema, assertMoneyPrecision } from "../../domain/cash";
import { InventoryError } from "../../domain/inventory";

const catalogInput = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["UNIT", "WEIGHT", "VOLUME", "LENGTH"]).default("UNIT"),
  unitCode: z.string().trim().min(1).max(16),
  unitName: z.string().trim().min(1).max(80),
  barcode: z.string().trim().min(4).max(64).optional(),
  price: z.string().regex(/^\d{1,18}(\.\d{1,4})?$/).optional(),
  currency: currencySchema.optional(),
}).strict();

export async function createCatalogItem(actor: Actor, input: z.input<typeof catalogInput>) {
  const data = catalogInput.parse(input);
  return inventoryTransaction(actor, "inventory.catalog.write", systemClock, async (tx, verified) => {
    const tenantId = verified.tenantId;
    const policy = await tx.unverifiedIntakePolicy.findUnique({ where: { tenantId } });
    const currency = data.currency ?? policy?.currency;
    if (data.price && !currency) throw new InventoryError("PRICE_CURRENCY_REQUIRED");
    if (data.price && currency) assertMoneyPrecision(data.price, currency);
    const unit = await tx.unitOfMeasure.upsert({
      where: { tenantId_code: { tenantId, code: data.unitCode } },
      create: { tenantId, code: data.unitCode, name: data.unitName },
      update: { name: data.unitName },
    });
    const product = await tx.product.create({
      data: {
        tenantId,
        sku: data.sku,
        name: data.name,
        kind: data.kind,
        baseUnitId: unit.id,
        variants: {
          create: {
            sku: data.sku,
            name: data.name,
            unitId: unit.id,
            quantityPrecision: data.kind === "UNIT" ? 0 : 3,
            ...(data.barcode
              ? { barcodes: { create: { code: data.barcode, type: "INTERNAL" } } }
              : {}),
            ...(data.price
              ? {
                  prices: {
                    create: {
                      amount: new Prisma.Decimal(data.price),
                      currency,
                      validFrom: new Date(),
                      channel: "RETAIL",
                    },
                  },
                }
              : {}),
          },
        },
      },
      include: { variants: { include: { barcodes: true, prices: true } } },
    });
    return product;
  });
}

import {
  parseConfiguredWeighedBarcode,
  weighedBarcodeConfigSchema,
  type WeighedBarcodeConfigInput,
} from "../../domain/weighed-barcode";

export async function upsertWeighedBarcodeConfig(actor: Actor, input: WeighedBarcodeConfigInput) {
  const data = weighedBarcodeConfigSchema.parse(input);
  return inventoryTransaction(actor, "inventory.catalog.write", systemClock, async (tx, verified) =>
    tx.weighedBarcodeConfig.upsert({
      where: { tenantId: verified.tenantId },
      create: { tenantId: verified.tenantId, ...data },
      update: data,
    }));
}

export async function resolvePriceWeighedBarcode(actor: Actor, raw: string) {
  return inventoryTransaction(actor, "inventory.catalog.read", systemClock, async (tx, verified) => {
    const stored = await tx.weighedBarcodeConfig.findUnique({ where: { tenantId: verified.tenantId } });
    if (!stored) throw new InventoryError("WEIGHED_BARCODE_NOT_CONFIGURED");
    let parsed;
    try {
      parsed = parseConfiguredWeighedBarcode(raw, {
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
    if (stored.mode !== "PRICE" || !parsed.amount) throw new InventoryError("WEIGHED_BARCODE_MODE_UNSUPPORTED");
    if (parsed.amount.isZero() || parsed.amount.isNegative()) throw new InventoryError("WEIGHED_BARCODE_ZERO_PRICE");
    const variant = await tx.productVariant.findFirst({
      where: { tenantId: verified.tenantId, sku: parsed.variantCode, active: true },
      include: { product: true },
    });
    if (!variant) throw new InventoryError("NOT_FOUND");
    return {
      variantId: variant.id,
      sku: variant.sku,
      name: variant.name,
      productName: variant.product.name,
      unitPrice: parsed.amount.toFixed(stored.valueScale),
    };
  });
}

export async function getCurrentPrice(actor: Actor, input: {
  variantId: string;
  channel?: "RETAIL" | "WHOLESALE" | "POS";
  branchId?: string;
  at?: Date;
}) {
  const at = input.at ?? new Date();
  return inventoryTransaction(actor, "inventory.catalog.read", systemClock, async (tx, verified) => {
  if (input.branchId && !verified.branchIds.includes(input.branchId)) throw new Error("NOT_FOUND");
  const price = await tx.price.findFirst({
    where: {
      tenantId: verified.tenantId,
      variantId: input.variantId,
      channel: input.channel ?? "RETAIL",
      validFrom: { lte: at },
      AND: [
        { OR: [{ validTo: null }, { validTo: { gt: at } }] },
        ...(input.branchId ? [{ OR: [{ branchId: input.branchId }, { branchId: null }] }] : [{ branchId: null }]),
      ],
    },
    orderBy: [{ branchId: { sort: "desc", nulls: "last" } }, { validFrom: "desc" }],
  });
  return price ? price.amount.toString() : null;
  });
}
