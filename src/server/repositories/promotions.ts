import type { Actor } from "../../domain/actor";
import { promotionConfigSchema, type PromotionConfigInput } from "../../domain/promotions";
import { InventoryError } from "../../domain/inventory";
import { inventoryTransaction, systemClock } from "./inventory";
import type { TransactionClient as Tx } from "./tenant-context";

function serializePromotion(promotion: {
  id: string;
  tenantId: string;
  branchId: string | null;
  categoryId: string;
  name: string;
  n: number;
  m: number;
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...promotion,
    n: promotion.n.toString(),
    m: promotion.m.toString(),
    validFrom: promotion.validFrom?.toISOString() ?? null,
    validTo: promotion.validTo?.toISOString() ?? null,
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
  };
}

async function assertScope(tx: Tx, actor: Actor, input: PromotionConfigInput): Promise<void> {
  if (input.branchId && !actor.branchIds.includes(input.branchId)) throw new InventoryError("NOT_FOUND");
  const category = await tx.productCategory.findFirst({ where: { tenantId: actor.tenantId, id: input.categoryId } });
  if (!category) throw new InventoryError("NOT_FOUND");
}

export async function listPromotions(actor: Actor) {
  return inventoryTransaction(actor, "inventory.catalog.read", systemClock, async (tx, verified) => {
    const promotions = await tx.promotion.findMany({
      where: { tenantId: verified.tenantId },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    });
    return promotions.map(serializePromotion);
  });
}

export async function createPromotion(actor: Actor, input: PromotionConfigInput) {
  const data = promotionConfigSchema.parse(input);
  return inventoryTransaction(actor, "inventory.catalog.write", systemClock, async (tx, verified) => {
    await assertScope(tx, verified, data);
    const promotion = await tx.promotion.create({
      data: {
        tenantId: verified.tenantId,
        branchId: data.branchId ?? null,
        categoryId: data.categoryId,
        name: data.name,
        n: Number(data.n),
        m: Number(data.m),
        active: data.active,
        validFrom: data.validFrom ?? null,
        validTo: data.validTo ?? null,
      },
    });
    return serializePromotion(promotion);
  });
}

export async function updatePromotion(actor: Actor, id: string, input: PromotionConfigInput) {
  const data = promotionConfigSchema.parse(input);
  return inventoryTransaction(actor, "inventory.catalog.write", systemClock, async (tx, verified) => {
    const existing = await tx.promotion.findFirst({ where: { tenantId: verified.tenantId, id } });
    if (!existing) throw new InventoryError("NOT_FOUND");
    await assertScope(tx, verified, data);
    const promotion = await tx.promotion.update({
      where: { id },
      data: {
        branchId: data.branchId ?? null,
        categoryId: data.categoryId,
        name: data.name,
        n: Number(data.n),
        m: Number(data.m),
        active: data.active,
        validFrom: data.validFrom ?? null,
        validTo: data.validTo ?? null,
      },
    });
    return serializePromotion(promotion);
  });
}

export async function deactivatePromotion(actor: Actor, id: string) {
  return inventoryTransaction(actor, "inventory.catalog.write", systemClock, async (tx, verified) => {
    const existing = await tx.promotion.findFirst({ where: { tenantId: verified.tenantId, id } });
    if (!existing) throw new InventoryError("NOT_FOUND");
    const promotion = await tx.promotion.update({ where: { id }, data: { active: false } });
    return serializePromotion(promotion);
  });
}
