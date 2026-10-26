import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";

const catalogInput = z.object({
  tenantId: z.string().uuid(),
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  kind: z.enum(["UNIT", "WEIGHT", "VOLUME", "LENGTH"]).default("UNIT"),
  unitCode: z.string().trim().min(1).max(16),
  unitName: z.string().trim().min(1).max(80),
  barcode: z.string().trim().min(4).max(64).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export async function createCatalogItem(input: z.input<typeof catalogInput>) {
  const data = catalogInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const unit = await tx.unitOfMeasure.upsert({
      where: { tenantId_code: { tenantId: data.tenantId, code: data.unitCode } },
      create: { tenantId: data.tenantId, code: data.unitCode, name: data.unitName },
      update: { name: data.unitName },
    });
    const product = await tx.product.create({
      data: {
        tenantId: data.tenantId,
        sku: data.sku,
        name: data.name,
        kind: data.kind,
        baseUnitId: unit.id,
        variants: {
          create: {
            sku: data.sku,
            name: data.name,
            unitId: unit.id,
            ...(data.barcode
              ? { barcodes: { create: { code: data.barcode, type: "INTERNAL" } } }
              : {}),
            ...(data.price
              ? {
                  prices: {
                    create: {
                      amount: new Prisma.Decimal(data.price),
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

export async function getCurrentPrice(input: {
  tenantId: string;
  variantId: string;
  channel?: "RETAIL" | "WHOLESALE" | "POS";
  branchId?: string;
  at?: Date;
}) {
  const at = input.at ?? new Date();
  const price = await prisma.price.findFirst({
    where: {
      tenantId: input.tenantId,
      variantId: input.variantId,
      channel: input.channel ?? "RETAIL",
      validFrom: { lte: at },
      AND: [
        { OR: [{ validTo: null }, { validTo: { gt: at } }] },
        ...(input.branchId ? [{ OR: [{ branchId: input.branchId }, { branchId: null }] }] : []),
      ],
    },
    orderBy: [{ branchId: "desc" }, { validFrom: "desc" }],
  });
  return price ? price.amount.toString() : null;
}
