import Decimal from "decimal.js";
import type { Actor, Permission } from "../../domain/actor";
import { InventoryError } from "../../domain/inventory";
import { inventoryTransaction } from "./inventory";
import { withTenant } from "./tenant-context";

export type ReadQuery = Readonly<{
  branchId?: string;
  locationId?: string;
  variantId?: string;
  from?: string;
  to?: string;
  limit: number;
}>;

function scope(actor: Actor, branchId?: string): { branchId?: string | { in: string[] } } {
  if (branchId && actor.role !== "ADMIN" && !actor.branchIds.includes(branchId)) throw new InventoryError("FORBIDDEN");
  return branchId ? { branchId } : actor.role === "ADMIN" && actor.branchIds.length === 0 ? {} : { branchId: { in: [...actor.branchIds] } };
}

function iso(value: Date): string { return value.toISOString(); }
function signed(quantity: string, direction: "IN" | "OUT"): string {
  const value = new Decimal(quantity);
  return (direction === "OUT" ? value.negated() : value).toString();
}

export async function listInventoryLevels(actor: Actor, query: ReadQuery) {
  return inventoryTransaction(actor, "inventory.level.read", { now: () => new Date() }, async (tx, verified) => {
    const branch = scope(verified, query.branchId);
    const rows = await tx.inventoryLevel.findMany({
      where: { tenantId: verified.tenantId, locationId: query.locationId, variantId: query.variantId, location: branch },
      include: { location: true, variant: { include: { product: true } }, lot: true },
      orderBy: [{ locationId: "asc" }, { variantId: "asc" }, { id: "asc" }],
      take: query.limit,
    });
    return { levels: rows.map((row) => ({ id: row.id, location: { id: row.location.id, code: row.location.code, name: row.location.name, branchId: row.location.branchId }, variant: { id: row.variant.id, sku: row.variant.sku, name: row.variant.name, productName: row.variant.product.name }, lot: row.lot ? { id: row.lot.id, lotNumber: row.lot.lotNumber, expiresAt: row.lot.expiresAt ? iso(row.lot.expiresAt) : null } : null, onHand: row.onHand.toString(), reserved: row.reserved.toString(), available: new Decimal(row.onHand.toString()).minus(row.reserved.toString()).toString() })), limit: query.limit };
  });
}

export async function listInventoryMovements(actor: Actor, query: ReadQuery) {
  return inventoryTransaction(actor, "inventory.ledger.read", { now: () => new Date() }, async (tx, verified) => {
    const branch = scope(verified, query.branchId);
    const rows = await tx.inventoryMovement.findMany({
      where: { tenantId: verified.tenantId, locationId: query.locationId, variantId: query.variantId, createdAt: { gte: query.from ? new Date(query.from) : undefined, lt: query.to ? new Date(query.to) : undefined }, location: branch },
      include: { location: true, variant: { include: { product: true } }, lot: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit,
    });
    return { movements: rows.map((row) => ({ id: row.id, type: row.type, direction: row.direction, quantity: row.quantity.toString(), quantityDelta: signed(row.quantity.toString(), row.direction), location: { id: row.location.id, code: row.location.code, name: row.location.name, branchId: row.location.branchId }, variant: { id: row.variant.id, sku: row.variant.sku, name: row.variant.name, productName: row.variant.product.name }, lot: row.lot ? { id: row.lot.id, lotNumber: row.lot.lotNumber, expiresAt: row.lot.expiresAt ? iso(row.lot.expiresAt) : null } : null, referenceId: row.referenceId, reason: row.reason, actorUserId: row.actorUserId, createdAt: iso(row.createdAt) })) };
  });
}

export async function listSales(actor: Actor, query: ReadQuery) {
  return readTenant(actor, "sales.read", async (tx, verified) => {
    const rows = await tx.sale.findMany({ where: { tenantId: verified.tenantId, branchId: scope(verified, query.branchId).branchId, createdAt: { gte: query.from ? new Date(query.from) : undefined, lt: query.to ? new Date(query.to) : undefined } }, include: { lines: true, payments: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: query.limit });
    return { sales: rows.map((row) => ({ id: row.id, documentNumber: row.documentNumber, branchId: row.branchId, locationId: row.locationId, registerSessionId: row.registerSessionId, actorUserId: row.actorUserId, total: row.total.toString(), currency: row.currency, createdAt: iso(row.createdAt), lineCount: row.lines.length, paymentCount: row.payments.length })), limit: query.limit };
  });
}

export async function getSale(actor: Actor, id: string) {
  return readTenant(actor, "sales.read", async (tx, verified) => {
    const row = await tx.sale.findFirst({ where: { tenantId: verified.tenantId, id }, include: { lines: true, payments: true } });
    if (!row || (verified.role !== "ADMIN" && row.branchId && !verified.branchIds.includes(row.branchId))) throw new InventoryError("NOT_FOUND");
    return { id: row.id, documentNumber: row.documentNumber, branchId: row.branchId, locationId: row.locationId, registerSessionId: row.registerSessionId, actorUserId: row.actorUserId, total: row.total.toString(), currency: row.currency, createdAt: iso(row.createdAt), lines: row.lines.map((line) => ({ id: line.id, variantId: line.variantId, productName: line.productName, quantity: line.quantity.toString(), unitPrice: line.unitPrice.toString(), sourceSnapshot: line.sourceSnapshot })), payments: row.payments.map((payment) => ({ id: payment.id, method: payment.method, amount: payment.amount.toString(), currency: payment.currency })) };
  });
}

export async function listCashShifts(actor: Actor, query: ReadQuery) {
  return readTenant(actor, "cash.history.read", async (tx, verified) => {
    const rows = await tx.cashRegisterSession.findMany({ where: { tenantId: verified.tenantId, branchId: scope(verified, query.branchId).branchId, openedAt: { gte: query.from ? new Date(query.from) : undefined, lt: query.to ? new Date(query.to) : undefined } }, include: { cashMovements: true }, orderBy: [{ openedAt: "desc" }, { id: "desc" }], take: query.limit });
    return { shifts: rows.map((row) => ({ id: row.id, branchId: row.branchId, registerId: row.registerId, userId: row.userId, currency: row.currency, openedAt: iso(row.openedAt), closedAt: row.closedAt ? iso(row.closedAt) : null, declaredCash: row.declaredCash?.toString() ?? null, expectedCash: row.expectedCash?.toString() ?? null, difference: row.difference?.toString() ?? null, movements: row.cashMovements.map((movement) => ({ id: movement.id, type: movement.type, amount: movement.amount.toString(), currency: movement.currency, actorUserId: movement.actorUserId, reason: movement.reason, createdAt: iso(movement.createdAt) })) })) };
  });
}

async function readTenant<T>(actor: Actor, permission: Permission, operation: (tx: Parameters<Parameters<typeof withTenant>[2]>[0], verified: Actor) => Promise<T>): Promise<T> {
  return inventoryTransaction(actor, permission, { now: () => new Date() }, async (tx, verified) => operation(tx, verified));
}
