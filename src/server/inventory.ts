import { Prisma, type PrismaClient, type RoleName } from "@prisma/client";
import { z } from "zod";
import { hasPermission } from "../domain/authorization";
import { prisma } from "./db";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
const quantitySchema = z.string().regex(/^\d+(\.\d{1,6})?$/).refine((value) => Number(value) > 0);

const movementInput = z.object({
  tenantId: z.string().uuid(),
  locationId: z.string().uuid(),
  variantId: z.string().uuid(),
  lotId: z.string().uuid().optional(),
  quantity: quantitySchema,
  actorUserId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(500),
});

function assertInventoryPermission(role: RoleName) {
  if (!hasPermission(role, "inventory:write")) throw new Error("FORBIDDEN");
}

async function ensureLevel(tx: Tx, input: { tenantId: string; locationId: string; variantId: string; lotId?: string | null }) {
  if (!input.lotId) {
    const existing = await tx.inventoryLevel.findFirst({
      where: { tenantId: input.tenantId, locationId: input.locationId, variantId: input.variantId, lotId: null },
    });
    if (existing) return existing;
    return tx.inventoryLevel.create({
      data: { tenantId: input.tenantId, locationId: input.locationId, variantId: input.variantId, onHand: 0, reserved: 0 },
    });
  }
  return tx.inventoryLevel.upsert({
    where: {
      tenantId_locationId_variantId_lotId: {
        tenantId: input.tenantId,
        locationId: input.locationId,
        variantId: input.variantId,
        lotId: input.lotId,
      },
    },
    create: {
      tenantId: input.tenantId,
      locationId: input.locationId,
      variantId: input.variantId,
      lotId: input.lotId ?? undefined,
      onHand: 0,
      reserved: 0,
    },
    update: {},
  });
}

export async function recordReceipt(input: z.input<typeof movementInput>, role: RoleName) {
  assertInventoryPermission(role);
  const data = movementInput.parse(input);
  return prisma.$transaction(async (tx) => {
    const level = await ensureLevel(tx, data);
    await tx.$executeRaw`SELECT "id" FROM "InventoryLevel" WHERE "id" = ${level.id} FOR UPDATE`;
    await tx.inventoryLevel.update({ where: { id: level.id }, data: { onHand: { increment: data.quantity } } });
    return tx.inventoryMovement.create({
      data: {
        tenantId: data.tenantId, locationId: data.locationId, variantId: data.variantId, lotId: data.lotId,
        quantity: data.quantity, direction: "IN", type: "RECEIPT", actorUserId: data.actorUserId, reason: data.reason,
      },
    });
  });
}

export async function confirmSale(input: {
  tenantId: string; locationId: string; variantId: string; quantity: string; unitPrice: string;
  actorUserId?: string; role: RoleName; reason?: string; allowUnverifiedIntake?: boolean; lotId?: string;
}) {
  const quantity = quantitySchema.parse(input.quantity);
  const unitPrice = z.string().regex(/^\d+(\.\d{1,2})?$/).parse(input.unitPrice);
  assertInventoryPermission(input.role);
  return prisma.$transaction(async (tx) => {
    const level = await ensureLevel(tx, input);
    const rows = await tx.$queryRaw<Array<{ onHand: Prisma.Decimal; reserved: Prisma.Decimal }>>`
      SELECT "onHand", "reserved" FROM "InventoryLevel" WHERE "id" = ${level.id} FOR UPDATE`;
    const onHand = new Prisma.Decimal(rows[0]?.onHand ?? 0);
    const reserved = new Prisma.Decimal(rows[0]?.reserved ?? 0);
    const available = onHand.minus(reserved);
    const requested = new Prisma.Decimal(quantity);
    const shortage = requested.minus(available);
    if (shortage.greaterThan(0) && !input.allowUnverifiedIntake) throw new Error("INSUFFICIENT_STOCK");

    const sale = await tx.sale.create({
      data: {
        tenantId: input.tenantId, locationId: input.locationId, actorUserId: input.actorUserId,
        total: requested.times(unitPrice),
        lines: { create: {
          tenantId: input.tenantId, variantId: input.variantId, quantity: requested,
          unitPrice: new Prisma.Decimal(unitPrice), productName: "snapshot",
        } },
      },
    });
    if (shortage.greaterThan(0)) {
      const review = await tx.unverifiedIntakeReview.create({
        data: {
          tenantId: input.tenantId, locationId: input.locationId, variantId: input.variantId, lotId: input.lotId,
          quantity: shortage, reason: input.reason ?? "Physical product present at checkout",
          createdBy: input.actorUserId,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId, actorUserId: input.actorUserId, action: "UNVERIFIED_INTAKE_CREATED",
          entityType: "UnverifiedIntakeReview", entityId: review.id,
          newValue: { quantity: shortage.toString(), locationId: input.locationId, variantId: input.variantId, reason: input.reason ?? null },
        },
      });
      await tx.inventoryLevel.update({ where: { id: level.id }, data: { onHand: { increment: shortage } } });
      await tx.inventoryMovement.create({
        data: {
          tenantId: input.tenantId, locationId: input.locationId, variantId: input.variantId, lotId: input.lotId,
          quantity: shortage, direction: "IN", type: "UNVERIFIED_INTAKE", referenceId: review.id,
          actorUserId: input.actorUserId, reason: input.reason ?? "UNVERIFIED_INTAKE",
        },
      });
    }
    await tx.inventoryLevel.update({ where: { id: level.id }, data: { onHand: { decrement: requested } } });
    await tx.inventoryMovement.create({
      data: {
        tenantId: input.tenantId, locationId: input.locationId, variantId: input.variantId, lotId: input.lotId,
        quantity: requested, direction: "OUT", type: "SALE", referenceId: sale.id, actorUserId: input.actorUserId,
        reason: "Sale",
      },
    });
    return sale;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reviewUnverifiedIntake(input: {
  tenantId: string; reviewId: string; actorUserId: string; role: RoleName;
  decision: "CONFIRMED" | "CORRECTED" | "REJECTED"; correctionQuantity?: string;
}) {
  if (!hasPermission(input.role, "inventory:write")) throw new Error("FORBIDDEN");
  const correction = input.correctionQuantity ? quantitySchema.parse(input.correctionQuantity) : undefined;
  return prisma.$transaction(async (tx) => {
    const review = await tx.unverifiedIntakeReview.findFirst({ where: { id: input.reviewId, tenantId: input.tenantId } });
    if (!review) throw new Error("NOT_FOUND");
    if (review.status !== "PENDING") throw new Error("REVIEW_ALREADY_CLOSED");
    const updated = await tx.unverifiedIntakeReview.update({
      where: { id: review.id },
      data: { status: input.decision, correctionQuantity: correction, reviewedBy: input.actorUserId, reviewedAt: new Date() },
    });
    if (input.decision === "CORRECTED" && correction) {
      const delta = new Prisma.Decimal(correction).minus(review.quantity);
      if (!delta.isZero()) {
        const level = await ensureLevel(tx, review);
        await tx.$executeRaw`SELECT "id" FROM "InventoryLevel" WHERE "id" = ${level.id} FOR UPDATE`;
        if (delta.isNegative()) {
          const current = await tx.inventoryLevel.findUniqueOrThrow({ where: { id: level.id } });
          if (current.onHand.lessThan(delta.abs())) throw new Error("CORRECTION_WOULD_NEGATE_STOCK");
        }
        await tx.inventoryLevel.update({
          where: { id: level.id },
          data: { onHand: delta.isPositive() ? { increment: delta } : { decrement: delta.abs() } },
        });
        await tx.inventoryMovement.create({
          data: {
            tenantId: review.tenantId, locationId: review.locationId, variantId: review.variantId, lotId: review.lotId,
            quantity: delta.abs(), direction: delta.isPositive() ? "IN" : "OUT", type: "ADJUSTMENT",
            referenceId: review.id, actorUserId: input.actorUserId, reason: "UNVERIFIED_INTAKE correction",
          },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId, actorUserId: input.actorUserId, action: `UNVERIFIED_INTAKE_${input.decision}`,
        entityType: "UnverifiedIntakeReview", entityId: review.id,
        previousValue: { status: review.status, quantity: review.quantity.toString() },
        newValue: { status: input.decision, correctionQuantity: correction ?? null },
      },
    });
    return updated;
  });
}

export async function reserveStock(input: {
  tenantId: string; locationId: string; variantId: string; quantity: string; referenceId?: string; lotId?: string;
}) {
  const quantity = quantitySchema.parse(input.quantity);
  return prisma.$transaction(async (tx) => {
    const level = await ensureLevel(tx, input);
    await tx.$executeRaw`SELECT "id" FROM "InventoryLevel" WHERE "id" = ${level.id} FOR UPDATE`;
    const current = await tx.inventoryLevel.findUniqueOrThrow({ where: { id: level.id } });
    const available = current.onHand.minus(current.reserved);
    if (available.lessThan(quantity)) throw new Error("INSUFFICIENT_STOCK");
    const reservation = await tx.reservation.create({
      data: {
        tenantId: input.tenantId, locationId: input.locationId, variantId: input.variantId, lotId: input.lotId,
        quantity, referenceId: input.referenceId,
      },
    });
    await tx.inventoryLevel.update({ where: { id: level.id }, data: { reserved: { increment: quantity } } });
    return reservation;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function releaseReservation(tenantId: string, reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findFirst({ where: { id: reservationId, tenantId, status: "ACTIVE" } });
    if (!reservation) throw new Error("RESERVATION_NOT_ACTIVE");
    const level = await ensureLevel(tx, reservation);
    await tx.inventoryLevel.update({ where: { id: level.id }, data: { reserved: { decrement: reservation.quantity } } });
    return tx.reservation.update({ where: { id: reservation.id }, data: { status: "RELEASED" } });
  });
}
