import type { Actor } from "../../domain/actor";
import { InventoryError } from "../../domain/inventory";
import { buildFiscalContext, type FiscalContext, type FiscalProfileInput } from "../../domain/fiscal";
import { audit, inventoryTransaction, type Clock } from "./inventory";

export async function configure(actor: Actor, input: FiscalProfileInput, clock: Clock): Promise<FiscalContext> {
  return inventoryTransaction(actor, "fiscal.profile.manage", clock, async (tx, verified) => {
    const store = await tx.store.findFirst({ where: { tenantId: verified.tenantId, id: input.storeId } });
    if (!store) throw new InventoryError("NOT_FOUND");
    const profile = await tx.fiscalProfile.upsert({
      where: { tenantId_storeId: { tenantId: verified.tenantId, storeId: store.id } },
      create: { tenantId: verified.tenantId, storeId: store.id, country: "AR", condition: input.condition, internalTicket: input.internalTicket },
      update: { country: "AR", condition: input.condition, internalTicket: input.internalTicket },
    });
    await audit(tx, verified, "fiscal.profile.configured", "FiscalProfile", profile.id, { storeId: store.id, condition: input.condition, internalTicket: input.internalTicket });
    return buildFiscalContext({ storeId: store.id, storeName: store.name, country: "AR", condition: input.condition, internalTicket: input.internalTicket });
  });
}

export async function getForBranch(actor: Actor, branchId: string, clock: Clock): Promise<FiscalContext | null> {
  return inventoryTransaction(actor, "fiscal.profile.read", clock, async (tx, verified) => {
    const branch = await tx.branch.findFirst({ where: { tenantId: verified.tenantId, id: branchId } });
    if (!branch || !verified.branchIds.includes(branchId)) throw new InventoryError("NOT_FOUND");
    const store = branch ? await tx.store.findFirst({ where: { tenantId: verified.tenantId, id: branch.storeId } }) : null;
    const profile = store ? await tx.fiscalProfile.findUnique({ where: { tenantId_storeId: { tenantId: verified.tenantId, storeId: store.id } } }) : null;
    if (!store || !profile) return null;
    return buildFiscalContext({ storeId: store.id, storeName: store.name, country: profile.country, condition: profile.condition, internalTicket: profile.internalTicket });
  });
}
