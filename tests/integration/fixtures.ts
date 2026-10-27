import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type RoleName } from "@prisma/client";
import Decimal from "decimal.js";
import type { Actor } from "../../src/domain/actor";

export const enabled = Boolean(process.env.DATABASE_URL && process.env.TEST_DATABASE_URL);
export const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL ?? "" }) });
export const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }) });
export const now = new Date("2026-10-26T12:00:00Z");
export const clock = { now: () => now };

export async function fixture(role: RoleName = "ADMIN", options: { cashSession?: boolean; unitPrice?: string } = {}) {
  const tenant = await admin.tenant.create({ data: { name: "Gate fixture", slug: crypto.randomUUID() } });
  const store = await admin.store.create({ data: { tenantId: tenant.id, name: "Gate store" } });
  const branch = await admin.branch.create({ data: { tenantId: tenant.id, storeId: store.id, code: "gate", name: "Gate branch" } });
  const fiscalProfile = await admin.fiscalProfile.create({ data: { tenantId: tenant.id, storeId: store.id, country: "AR", condition: "MONOTRIBUTO", internalTicket: true } });
  const unit = await admin.unitOfMeasure.create({ data: { tenantId: tenant.id, code: "u", name: "Unit" } });
  const product = await admin.product.create({ data: { tenantId: tenant.id, sku: "p", name: "Product", baseUnitId: unit.id } });
  const variant = await admin.productVariant.create({ data: { tenantId: tenant.id, productId: product.id, unitId: unit.id, sku: "v", name: "Variant" } });
  const location = await admin.location.create({ data: { tenantId: tenant.id, branchId: branch.id, code: "l", name: "Location" } });
  const actor = await addActor(tenant.id, branch.id, role);
  const policy = await admin.unverifiedIntakePolicy.create({ data: { tenantId: tenant.id, currency: "XTS", maxSessionValue: "100000" } });
  const price = await admin.price.create({ data: { tenantId: tenant.id, variantId: variant.id, currency: "XTS", amount: options.unitPrice ?? "1", validFrom: new Date("2020-01-01T00:00:00Z") } });
  const register = await admin.cashRegister.create({ data: { tenantId: tenant.id, branchId: branch.id, name: "Gate register" } });
  const registerSession = options.cashSession === false ? null : await admin.cashRegisterSession.create({ data: { tenantId: tenant.id,
    registerId: register.id, branchId: branch.id, userId: actor.userId, currency: "XTS", openedAt: now } });
  return { actor, tenantId: tenant.id, storeId: store.id, branchId: branch.id, variantId: variant.id, locationId: location.id,
    stock: { variantId: variant.id, locationId: location.id }, unitId: unit.id, productId: product.id,
    registerId: register.id, registerSessionId: registerSession?.id, priceId: price.id, policy, fiscalProfileId: fiscalProfile.id };
}

export async function addActor(tenantId: string, branchId: string, role: RoleName): Promise<Actor> {
  const user = await admin.user.create({ data: { tenantId, email: `${crypto.randomUUID()}@example.test`, displayName: "Gate user" } });
  const storedRole = await admin.role.upsert({ where: { tenantId_name: { tenantId, name: role } }, create: { tenantId, name: role }, update: {} });
  await admin.userRole.create({ data: { tenantId, userId: user.id, roleId: storedRole.id } });
  await admin.userBranch.create({ data: { tenantId, userId: user.id, branchId } });
  const session = await admin.session.create({ data: { userId: user.id, token: crypto.randomUUID(), expiresAt: new Date("2030-01-01T00:00:00Z") } });
  // Permissions here are intentionally empty: repository re-derives them from persisted roles.
  return { tenantId, userId: user.id, role, branchIds: [branchId], sessionId: session.id, permissions: [] };
}

export async function reconcile(tenantId: string) {
  const levels = await admin.inventoryLevel.findMany({ where: { tenantId } });
  const movements = await admin.inventoryMovement.findMany({ where: { tenantId } });
  return levels.filter((level) => {
    const balance = movements.filter((movement) => movement.locationId === level.locationId && movement.variantId === level.variantId && movement.lotId === level.lotId)
      .reduce((sum, movement) => sum.plus(new Decimal(movement.quantity.toString()).times(movement.direction === "IN" ? "1" : "-1")), new Decimal(0));
    return !balance.equals(level.onHand.toString()) || level.onHand.isNegative() || level.reserved.isNegative() || level.reserved.greaterThan(level.onHand);
  });
}
