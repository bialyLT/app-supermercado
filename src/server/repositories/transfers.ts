import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import type { Actor } from "../../domain/actor";
import { TransferError, transferInputSchema, type TransferInput } from "../../domain/transfers";
import { prisma } from "./client";
import { withTenant } from "./tenant-context";

export type Clock = { now(): Date };
export const systemClock: Clock = { now: () => new Date() };

function hashPayload(input: TransferInput, userId: string): string {
  return createHash("sha256").update(JSON.stringify({ type: "INVENTORY_TRANSFER", userId, input })).digest("hex");
}

function verifyPermission(actor: Actor): void {
  if (!actor.permissions.includes("inventory.transfer") && !actor.permissions.includes("inventory.write") && !["STOCK_MANAGER", "ADMIN"].includes(actor.role)) {
    throw new TransferError("FORBIDDEN");
  }
}

export async function listTransfers(actor: Actor) {
  verifyPermission(actor);
  return withTenant(prisma, actor, async (tx) => {
    const branchScope = actor.role === "ADMIN" && actor.branchIds.length === 0
      ? undefined
      : { in: [...actor.branchIds] };
    const transfers = await tx.inventoryTransfer.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(branchScope ? {
          OR: [{ originBranchId: branchScope }, { destinationBranchId: branchScope }],
        } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      include: {
        originBranch: { select: { name: true, code: true } },
        destinationBranch: { select: { name: true, code: true } },
        originLocation: { select: { name: true, code: true } },
        destinationLocation: { select: { name: true, code: true } },
        lines: {
          include: {
            variant: { select: { name: true, sku: true } },
          },
        },
      },
    });

    return transfers.map((transfer) => ({
      id: transfer.id,
      originBranchId: transfer.originBranchId,
      destinationBranchId: transfer.destinationBranchId,
      originLocationId: transfer.originLocationId,
      destinationLocationId: transfer.destinationLocationId,
      originBranchName: `${transfer.originBranch.name} (${transfer.originBranch.code})`,
      destinationBranchName: `${transfer.destinationBranch.name} (${transfer.destinationBranch.code})`,
      originLocationName: `${transfer.originLocation.name} (${transfer.originLocation.code})`,
      destinationLocationName: `${transfer.destinationLocation.name} (${transfer.destinationLocation.code})`,
      reason: transfer.reason,
      status: transfer.status,
      createdAt: transfer.createdAt.toISOString(),
      idempotencyKey: transfer.idempotencyKey,
      lines: transfer.lines.map((line) => ({
        id: line.id,
        variantId: line.variantId,
        variantName: line.variant.name,
        sku: line.variant.sku,
        lotId: line.lotId,
        quantity: line.quantity.toString(),
      })),
    }));
  });
}

export async function createTransfer(actor: Actor, input: TransferInput, clock: Clock = systemClock) {
  verifyPermission(actor);
  const parsed = transferInputSchema.parse(input);

  return withTenant(prisma, actor, async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId}, 0))`;
    const payloadHash = hashPayload(parsed, actor.userId);
    const existing = await tx.idempotencyCommand.findUnique({
      where: { tenantId_commandId: { tenantId: actor.tenantId, commandId: parsed.idempotencyKey } },
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw new TransferError("IDEMPOTENCY_CONFLICT");
      const prior = await tx.inventoryTransfer.findFirst({
        where: { tenantId: actor.tenantId, id: existing.resultId },
        include: { lines: true },
      });
      if (prior) return prior;
      throw new TransferError("IDEMPOTENCY_CONFLICT", "Transfer result is missing");
    }

    const [originBranch, destinationBranch, originLocation, destinationLocation] = await Promise.all([
      tx.branch.findFirst({ where: { tenantId: actor.tenantId, id: parsed.originBranchId } }),
      tx.branch.findFirst({ where: { tenantId: actor.tenantId, id: parsed.destinationBranchId } }),
      tx.location.findFirst({ where: { tenantId: actor.tenantId, id: parsed.originLocationId, active: true } }),
      tx.location.findFirst({ where: { tenantId: actor.tenantId, id: parsed.destinationLocationId, active: true } }),
    ]);
    if (!originBranch || !destinationBranch || !originLocation || !destinationLocation) throw new TransferError("NOT_FOUND");
    if (originLocation.branchId !== originBranch.id || destinationLocation.branchId !== destinationBranch.id) throw new TransferError("NOT_FOUND");
    if (!actor.branchIds.includes(originBranch.id) || !actor.branchIds.includes(destinationBranch.id)) throw new TransferError("NOT_FOUND");

    const plans = [] as Array<{ variantId: string; lotId: string | null; quantity: string; quantityPrecision: number }>;
    for (const line of parsed.lines) {
      const variant = await tx.productVariant.findFirst({ where: { tenantId: actor.tenantId, id: line.variantId, active: true } });
      if (!variant) throw new TransferError("NOT_FOUND");
      if (new Decimal(line.quantity).decimalPlaces() > variant.quantityPrecision) throw new TransferError("INVALID_QUANTITY_PRECISION");
      if (line.lotId) {
        const lot = await tx.lot.findFirst({ where: { tenantId: actor.tenantId, id: line.lotId, variantId: line.variantId } });
        if (!lot) throw new TransferError("NOT_FOUND");
      }
      plans.push({ variantId: line.variantId, lotId: line.lotId ?? null, quantity: line.quantity, quantityPrecision: variant.quantityPrecision });
    }

    const sorted = [...plans].sort((a, b) => `${a.variantId}:${a.lotId ?? ""}`.localeCompare(`${b.variantId}:${b.lotId ?? ""}`));
    for (const plan of sorted) {
      const source = await tx.inventoryLevel.findFirst({
        where: { tenantId: actor.tenantId, locationId: originLocation.id, variantId: plan.variantId, lotId: plan.lotId },
      });
      if (!source) throw new TransferError("INSUFFICIENT_STOCK");
      await tx.$queryRaw`SELECT "id" FROM "InventoryLevel" WHERE "id" = ${source.id}::uuid FOR UPDATE`;
      const changed = await tx.inventoryLevel.updateMany({
        where: {
          id: source.id,
          tenantId: actor.tenantId,
          onHand: { gte: new Decimal(plan.quantity).plus(source.reserved) },
        },
        data: { onHand: { decrement: plan.quantity } },
      });
      if (changed.count !== 1) throw new TransferError("INSUFFICIENT_STOCK");
    }

    const transfer = await tx.inventoryTransfer.create({
      data: {
        tenantId: actor.tenantId,
        originBranchId: originBranch.id,
        destinationBranchId: destinationBranch.id,
        originLocationId: originLocation.id,
        destinationLocationId: destinationLocation.id,
        reason: parsed.reason,
        actorUserId: actor.userId,
        idempotencyKey: parsed.idempotencyKey,
        createdAt: clock.now(),
        lines: { create: plans.map((plan) => ({ tenantId: actor.tenantId, variantId: plan.variantId, lotId: plan.lotId, quantity: plan.quantity })) },
      },
      include: { lines: true },
    });

    for (const plan of plans) {
      const destination = await tx.inventoryLevel.findFirst({
        where: { tenantId: actor.tenantId, locationId: destinationLocation.id, variantId: plan.variantId, lotId: plan.lotId },
      });
      if (destination) {
        await tx.inventoryLevel.update({ where: { id: destination.id }, data: { onHand: { increment: plan.quantity } } });
      } else {
        await tx.inventoryLevel.create({ data: { tenantId: actor.tenantId, locationId: destinationLocation.id, variantId: plan.variantId, lotId: plan.lotId, onHand: plan.quantity, reserved: "0" } });
      }
      const suffix = `${plan.variantId}:${plan.lotId ?? "no-lot"}`;
      await tx.inventoryMovement.create({ data: {
        tenantId: actor.tenantId, locationId: originLocation.id, variantId: plan.variantId, lotId: plan.lotId,
        type: "TRANSFER_OUT", direction: "OUT", quantity: plan.quantity, referenceId: transfer.id,
        actorUserId: actor.userId, reason: parsed.reason ?? "Inventory transfer", idempotencyKey: `${parsed.idempotencyKey}:out:${suffix}`,
      } });
      await tx.inventoryMovement.create({ data: {
        tenantId: actor.tenantId, locationId: destinationLocation.id, variantId: plan.variantId, lotId: plan.lotId,
        type: "TRANSFER_IN", direction: "IN", quantity: plan.quantity, referenceId: transfer.id,
        actorUserId: actor.userId, reason: parsed.reason ?? "Inventory transfer", idempotencyKey: `${parsed.idempotencyKey}:in:${suffix}`,
      } });
    }

    await tx.idempotencyCommand.create({
      data: {
        tenantId: actor.tenantId,
        commandId: parsed.idempotencyKey,
        payloadHash,
        resultType: "INVENTORY_TRANSFER",
        resultId: transfer.id,
        result: { id: transfer.id, type: "INVENTORY_TRANSFER" },
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "inventory.transfer.completed",
        entityType: "InventoryTransfer",
        entityId: transfer.id,
        newValue: { originBranchId: originBranch.id, destinationBranchId: destinationBranch.id, lines: plans.length },
      },
    });
    return transfer;
  });
}
