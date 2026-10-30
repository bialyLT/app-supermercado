import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import type { Actor } from "../../domain/actor";
import {
  type DirectPurchaseReceiptInput,
  type SupplierInput,
  PurchaseError,
  calculatePurchaseTotals,
  directPurchaseReceiptInputSchema,
  supplierInputSchema,
} from "../../domain/purchases";
import { prisma } from "./client";
import { withTenant } from "./tenant-context";

export type Clock = { now(): Date };
export const systemClock: Clock = { now: () => new Date() };

function hashPayload(type: string, userId: string, input: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify({ type, userId, input }))
    .digest("hex");
}

function verifyPurchasePermission(actor: Actor): void {
  const allowed =
    actor.permissions.includes("inventory.receive") ||
    actor.permissions.includes("inventory.write") ||
    actor.role === "ADMIN" ||
    actor.role === "STOCK_MANAGER";
  if (!allowed) {
    throw new PurchaseError("FORBIDDEN");
  }
}

export async function createSupplier(actor: Actor, input: SupplierInput) {
  verifyPurchasePermission(actor);
  const parsed = supplierInputSchema.parse(input);
  return withTenant(prisma, actor, async (tx) => {
    return tx.supplier.create({
      data: {
        tenantId: actor.tenantId,
        code: parsed.code,
        name: parsed.name,
        taxId: parsed.taxId,
        email: parsed.email,
        phone: parsed.phone,
        address: parsed.address,
        active: parsed.active,
      },
    });
  });
}

export async function listSuppliers(actor: Actor) {
  verifyPurchasePermission(actor);
  return withTenant(prisma, actor, async (tx) => {
    return tx.supplier.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });
}

export async function getSupplier(actor: Actor, id: string) {
  verifyPurchasePermission(actor);
  return withTenant(prisma, actor, async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!supplier) throw new PurchaseError("NOT_FOUND");
    return supplier;
  });
}

export async function createDirectPurchaseReceipt(
  actor: Actor,
  input: DirectPurchaseReceiptInput,
  clock: Clock = systemClock,
) {
  verifyPurchasePermission(actor);
  const parsed = directPurchaseReceiptInputSchema.parse(input);

  return withTenant(prisma, actor, async (tx) => {
    // 1. Idempotency preflight
    const payloadHash = hashPayload("DIRECT_PURCHASE_RECEIPT", actor.userId, parsed);
    const existingCommand = await tx.idempotencyCommand.findUnique({
      where: {
        tenantId_commandId: {
          tenantId: actor.tenantId,
          commandId: parsed.idempotencyKey,
        },
      },
    });

    if (existingCommand) {
      if (existingCommand.payloadHash !== payloadHash) {
        throw new PurchaseError("IDEMPOTENCY_CONFLICT");
      }
      const existingReceipt = await tx.purchaseReceipt.findFirst({
        where: { tenantId: actor.tenantId, idempotencyKey: parsed.idempotencyKey },
        include: { lines: true, supplier: true },
      });
      if (existingReceipt) return existingReceipt;
    }

    // 2. Validate branch and location access
    const location = await tx.location.findFirst({
      where: { id: parsed.locationId, tenantId: actor.tenantId, active: true },
    });
    if (!location || !location.branchId) {
      throw new PurchaseError("NOT_FOUND", "Location not found");
    }
    if (location.branchId !== parsed.branchId) {
      throw new PurchaseError("NOT_FOUND", "Location does not belong to specified branch");
    }
    if (actor.branchIds.length > 0 && !actor.branchIds.includes(parsed.branchId)) {
      throw new PurchaseError("NOT_FOUND", "Branch not accessible to actor");
    }

    // 3. Validate supplier
    const supplier = await tx.supplier.findFirst({
      where: { id: parsed.supplierId, tenantId: actor.tenantId, active: true },
    });
    if (!supplier) {
      throw new PurchaseError("NOT_FOUND", "Supplier not found");
    }

    // 4. Currency is tenant configuration, never a business default or client authority.
    const policy = await tx.unverifiedIntakePolicy.findUnique({ where: { tenantId: actor.tenantId } });
    if (!policy?.currency || !policy.maxSessionValue) {
      throw new PurchaseError("MONETARY_CONFIGURATION_REQUIRED");
    }
    if (policy.currency !== parsed.currency) {
      throw new PurchaseError("CURRENCY_MISMATCH");
    }

    // 5. Calculate and validate totals server-side
    const calculated = calculatePurchaseTotals({
      currency: parsed.currency,
      subtotal: parsed.subtotal,
      taxTotal: parsed.taxTotal,
      discountTotal: parsed.discountTotal,
      total: parsed.total,
      lines: parsed.lines,
    });

    // 5. Validate variants, lots, and quantity precision
    type LinePlan = {
      variantId: string;
      resolvedLotId: string | null;
      quantity: string;
      unitCost: string;
      taxRate?: string;
      taxAmount: string;
      discountAmount: string;
      subtotal: string;
      total: string;
    };

    const plannedLines: LinePlan[] = [];

    for (const line of calculated.lines) {
      const variant = await tx.productVariant.findFirst({
        where: { id: line.variantId, tenantId: actor.tenantId, active: true },
      });
      if (!variant) {
        throw new PurchaseError("NOT_FOUND", `Variant ${line.variantId} not found`);
      }

      if (new Decimal(line.quantity).decimalPlaces() > variant.quantityPrecision) {
        throw new PurchaseError(
          "INVALID_QUANTITY_PRECISION",
          `Quantity precision exceeded for variant ${variant.sku}`,
        );
      }

      let resolvedLotId: string | null = null;
      if (line.lotId) {
        const lot = await tx.lot.findFirst({
          where: { id: line.lotId, tenantId: actor.tenantId, variantId: line.variantId },
        });
        if (!lot) {
          throw new PurchaseError("NOT_FOUND", `Lot ${line.lotId} not found`);
        }
        resolvedLotId = lot.id;
      } else if (line.lotNumber) {
        const lot = await tx.lot.upsert({
          where: {
            tenantId_variantId_lotNumber: {
              tenantId: actor.tenantId,
              variantId: line.variantId,
              lotNumber: line.lotNumber,
            },
          },
          create: {
            tenantId: actor.tenantId,
            variantId: line.variantId,
            lotNumber: line.lotNumber,
            expiresAt: line.expiresAt ? new Date(line.expiresAt) : null,
          },
          update: {},
        });
        resolvedLotId = lot.id;
      }

      plannedLines.push({
        variantId: line.variantId,
        resolvedLotId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        discountAmount: line.discountAmount,
        subtotal: line.subtotal,
        total: line.total,
      });
    }

    // 6. Deterministic level update ordering (locationId, variantId, lotId) to avoid deadlocks
    const sortedLevels = [...plannedLines].sort((a, b) => {
      const vComp = a.variantId.localeCompare(b.variantId);
      if (vComp !== 0) return vComp;
      return (a.resolvedLotId ?? "").localeCompare(b.resolvedLotId ?? "");
    });

    for (const plan of sortedLevels) {
      const where = {
        tenantId: actor.tenantId,
        locationId: parsed.locationId,
        variantId: plan.variantId,
        lotId: plan.resolvedLotId,
      };

      const existingLevel = await tx.inventoryLevel.findFirst({ where });
      if (!existingLevel) {
        await tx.inventoryLevel.create({
          data: {
            ...where,
            onHand: plan.quantity,
            reserved: "0",
          },
        });
      } else {
        await tx.inventoryLevel.update({
          where: { id: existingLevel.id },
          data: { onHand: { increment: plan.quantity } },
        });
      }
    }

    // 7. Persist PurchaseReceipt and Lines
    const receipt = await tx.purchaseReceipt.create({
      data: {
        tenantId: actor.tenantId,
        branchId: parsed.branchId,
        locationId: parsed.locationId,
        supplierId: parsed.supplierId,
        receiptNumber: parsed.receiptNumber,
        issuedAt: parsed.issuedAt ? new Date(parsed.issuedAt) : clock.now(),
        receivedAt: clock.now(),
        currency: calculated.currency,
        subtotal: calculated.subtotal,
        taxTotal: calculated.taxTotal,
        discountTotal: calculated.discountTotal,
        total: calculated.total,
        notes: parsed.notes,
        actorUserId: actor.userId,
        idempotencyKey: parsed.idempotencyKey,
        lines: {
          create: plannedLines.map((l) => ({
            tenantId: actor.tenantId,
            variantId: l.variantId,
            lotId: l.resolvedLotId,
            quantity: l.quantity,
            unitCost: l.unitCost,
            subtotal: l.subtotal,
            taxRate: l.taxRate,
            taxAmount: l.taxAmount,
            discountAmount: l.discountAmount,
            total: l.total,
          })),
        },
      },
      include: {
        lines: true,
        supplier: true,
      },
    });

    // 8. Server-side stock ledger movements (InventoryMovement)
    for (let index = 0; index < plannedLines.length; index += 1) {
      const l = plannedLines[index];
      await tx.inventoryMovement.create({
        data: {
          tenantId: actor.tenantId,
          locationId: parsed.locationId,
          variantId: l.variantId,
          lotId: l.resolvedLotId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          direction: "IN",
          type: "RECEIPT",
          referenceId: receipt.id,
          actorUserId: actor.userId,
          reason: `Direct purchase receipt ${receipt.receiptNumber ?? receipt.id}`,
          idempotencyKey: `${parsed.idempotencyKey}:line:${index}`,
        },
      });
    }

    // 9. Record Idempotency Command
    const commandResult = {
      id: receipt.id,
      type: "DIRECT_PURCHASE_RECEIPT",
      total: receipt.total.toString(),
      currency: receipt.currency,
      receiptNumber: receipt.receiptNumber ?? undefined,
    };

    await tx.idempotencyCommand.create({
      data: {
        tenantId: actor.tenantId,
        commandId: parsed.idempotencyKey,
        payloadHash,
        resultType: "DIRECT_PURCHASE_RECEIPT",
        resultId: receipt.id,
        result: commandResult,
      },
    });

    // 10. Audit logging
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "purchase.received",
        entityType: "PurchaseReceipt",
        entityId: receipt.id,
        newValue: {
          id: receipt.id,
          supplierId: receipt.supplierId,
          branchId: receipt.branchId,
          locationId: receipt.locationId,
          subtotal: receipt.subtotal.toString(),
          taxTotal: receipt.taxTotal.toString(),
          discountTotal: receipt.discountTotal.toString(),
          total: receipt.total.toString(),
          linesCount: receipt.lines.length,
        },
      },
    });

    return receipt;
  });
}

export async function listPurchaseReceipts(
  actor: Actor,
  filters?: { branchId?: string; supplierId?: string },
) {
  verifyPurchasePermission(actor);
  return withTenant(prisma, actor, async (tx) => {
    return tx.purchaseReceipt.findMany({
      where: {
        tenantId: actor.tenantId,
        branchId: filters?.branchId,
        supplierId: filters?.supplierId,
      },
      include: {
        supplier: true,
        lines: true,
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    });
  });
}

export async function getPurchaseReceipt(actor: Actor, id: string) {
  verifyPurchasePermission(actor);
  return withTenant(prisma, actor, async (tx) => {
    const receipt = await tx.purchaseReceipt.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        supplier: true,
        lines: true,
      },
    });
    if (!receipt) throw new PurchaseError("NOT_FOUND");
    return receipt;
  });
}
