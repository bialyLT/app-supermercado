import type { Prisma } from "@prisma/client";
import type { Actor } from "../../domain/actor";
import { inventoryTransaction, systemClock } from "./inventory";

export async function listSyncConflicts(actor: Actor) {
  return inventoryTransaction(actor, "inventory.catalog.read", systemClock, async (tx, verified) =>
    tx.syncConflict.findMany({ where: { tenantId: verified.tenantId, status: "OPEN" }, orderBy: { createdAt: "asc" } }));
}

export async function resolveSyncConflict(actor: Actor, id: string, status: "RESOLVED" | "REJECTED", resolution: Prisma.InputJsonValue) {
  return inventoryTransaction(actor, "inventory.catalog.write", systemClock, async (tx, verified) =>
    tx.syncConflict.update({ where: { tenantId_id: { tenantId: verified.tenantId, id } }, data: { status, resolution, resolvedByUserId: verified.userId, resolvedAt: new Date() } }));
}

export async function recordSyncConflict(actor: Actor, input: {
  commandId: string;
  kind: "STOCK_DISCREPANCY" | "PRODUCT_DUPLICATE" | "REVERSAL_CONFLICT";
  payload: Prisma.InputJsonValue;
  existingEntityId?: string;
}) {
  return inventoryTransaction(actor, "inventory.catalog.write", systemClock, async (tx, verified) => tx.syncConflict.create({
    data: { tenantId: verified.tenantId, commandId: input.commandId, kind: input.kind, payload: input.payload,
      existingEntityId: input.existingEntityId },
  }));
}
