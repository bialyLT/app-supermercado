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
