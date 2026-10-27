import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Actor, Permission } from "../../domain/actor";
import { selectFefoLots } from "../../domain/fefo";
import { money, assertMoneyPrecision, FinancialDecimal } from "../../domain/cash";
import { buildFiscalSnapshot, type FiscalContext } from "../../domain/fiscal";
import { assertQuantityPrecision, InventoryError, type Receipt, type SaleInput, type MultiSaleInput, type ReservationInput, type ReviewInput } from "../../domain/inventory";
import { prisma } from "./client";
import { withTenant, type TransactionClient as Tx } from "./tenant-context";
import { configuredPolicy, currentRegisterSession } from "./cash";
import { consume } from "./approval";

export const inventoryPermissions: Record<Actor["role"], readonly Permission[]> = {
  CASHIER: ["cash.session.open", "cash.session.close", "inventory.sell", "inventory.catalog.read", "inventory.unverified_intake.create"],
  STOCK_MANAGER: ["inventory.receive", "inventory.reserve", "inventory.catalog.read", "inventory.catalog.write", "inventory.unverified_intake.review", "fiscal.profile.read"],
  SUPERVISOR: ["cash.session.open", "cash.session.close", "cash.session.close.other", "identity.supervisor_pin.manage", "inventory.sale.approve", "inventory.sell", "inventory.reserve", "inventory.catalog.read", "inventory.unverified_intake.create", "inventory.unverified_intake.review", "inventory.expired.override"],
  ADMIN: ["inventory.policy.manage", "cash.session.open", "cash.session.close", "cash.session.close.other", "identity.supervisor_pin.manage", "inventory.sale.approve", "inventory.write", "inventory.receive", "inventory.sell", "inventory.reserve", "inventory.catalog.read", "inventory.catalog.write", "inventory.unverified_intake.create", "inventory.unverified_intake.review", "inventory.expired.override", "fiscal.profile.manage", "fiscal.profile.read"],
};
export const systemClock = { now: () => new Date() };
export type Clock = { now(): Date };
const resultSchema = z.object({ id: z.string(), type: z.string(), total: z.string().optional(), currency: z.string().optional() });
export type CommandResult = z.infer<typeof resultSchema>;

async function verifyActor(tx: Tx, actor: Actor, now: Date): Promise<Actor> {
  if (!actor?.sessionId) throw new InventoryError("UNAUTHENTICATED");
  const session = await tx.session.findFirst({ where: { id: actor.sessionId, userId: actor.userId, expiresAt: { gt: now } },
    include: { user: { include: { roles: { include: { role: true } }, branches: true } } } });
  if (!session?.user || !session.user.active || session.user.tenantId !== actor.tenantId) throw new InventoryError("UNAUTHENTICATED");
  const roles = session.user.roles.map(({ role }) => role.name);
  if (!roles.includes(actor.role)) throw new InventoryError("FORBIDDEN");
  return { ...actor, branchIds: session.user.branches.map(({ branchId }) => branchId),
    permissions: [...new Set(roles.flatMap((role) => inventoryPermissions[role]))] };
}

async function retry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      // Prisma 7's pg adapter nests the SQLSTATE in DriverAdapterError.cause.
      const driver = z.object({ driverAdapterError: z.object({ cause: z.object({ originalCode: z.string() }) }) })
        .safeParse(error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : undefined);
      const sqlState = driver.success ? driver.data.driverAdapterError.cause.originalCode : "";
      const transient = error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || (error.code === "P2010" && ["40001", "40P01"].includes(sqlState || String(error.meta?.code))));
      if (!transient || attempt >= 2) throw error;
    }
  }
}

export async function inventoryTransaction<T>(actor: Actor, permission: Permission, clock: Clock, operation: (tx: Tx, verified: Actor, now: Date) => Promise<T>): Promise<T> {
  return retry(() => withTenant(prisma, actor, async (tx) => {
    // Serializes caps and idempotency as well as first creation of a NULL-lot level.
    // Conservative tenant-wide lock for Epic 2; level updates remain conditional.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId}, 0))`;
    const now = clock.now();
    const verified = await verifyActor(tx, actor, now);
    if (!verified.permissions.includes(permission)) throw new InventoryError("FORBIDDEN");
    return operation(tx, verified, now);
  }));
}

export async function auditDenial(actor: Actor, code: string, clock: Clock): Promise<void> {
  await withTenant(prisma, actor, async (tx) => {
    const now = clock.now();
    const verified = await verifyActor(tx, actor, now);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${actor.tenantId}, 0))`;
    const bucket = new Date(Math.floor(now.getTime() / 60000) * 60000);
    const count = await tx.auditLog.count({ where: { tenantId: actor.tenantId, actorUserId: verified.userId, action: "inventory.denied", createdAt: { gte: bucket } } });
    if (count < 10) await audit(tx, verified, "inventory.denied", "Inventory", undefined, { code });
  });
}

export async function audit(tx: Tx, actor: Actor, action: string, entityType: string, entityId?: string, newValue?: Prisma.InputJsonValue) {
  await tx.auditLog.create({ data: { tenantId: actor.tenantId, actorUserId: actor.userId, action, entityType, entityId, newValue } });
}

export async function locationAccess(tx: Tx, actor: Actor, locationId: string) {
  const location = await tx.location.findFirst({ where: { id: locationId, tenantId: actor.tenantId, active: true } });
  if (!location || !location.branchId || !actor.branchIds.includes(location.branchId)) throw new InventoryError("NOT_FOUND");
  return location;
}

async function stockAccess(tx: Tx, actor: Actor, input: { locationId: string; variantId: string; lotId?: string; quantity: string }) {
  const location = await locationAccess(tx, actor, input.locationId);
  const variant = await tx.productVariant.findFirst({ where: { id: input.variantId, tenantId: actor.tenantId, active: true } });
  if (!variant) throw new InventoryError("NOT_FOUND");
  assertQuantityPrecision(input.quantity, variant.quantityPrecision);
  if (input.lotId && !await tx.lot.findFirst({ where: { id: input.lotId, tenantId: actor.tenantId, variantId: input.variantId } }))
    throw new InventoryError("NOT_FOUND");
  return { location, variant };
}

async function level(tx: Tx, actor: Actor, input: { locationId: string; variantId: string; lotId?: string | null }) {
  const where = { tenantId: actor.tenantId, locationId: input.locationId, variantId: input.variantId, lotId: input.lotId ?? null };
  return await tx.inventoryLevel.findFirst({ where }) ?? await tx.inventoryLevel.create({ data: { ...where, onHand: "0", reserved: "0" } });
}

export async function command(tx: Tx, actor: Actor, type: string, input: { idempotencyKey: string }, execute: () => Promise<CommandResult>): Promise<CommandResult> {
  // Inputs are parsed, normalized and schema-ordered before hashing. Include operation and actor.
  const payloadHash = createHash("sha256").update(JSON.stringify({ type, userId: actor.userId, input })).digest("hex");
  const previous = await tx.idempotencyCommand.findUnique({ where: { tenantId_commandId: { tenantId: actor.tenantId, commandId: input.idempotencyKey } } });
  if (previous) {
    if (previous.payloadHash !== payloadHash) throw new InventoryError("IDEMPOTENCY_CONFLICT");
    return resultSchema.parse(previous.result);
  }
  const legacy = await tx.inventoryMovement.findFirst({ where: { tenantId: actor.tenantId, idempotencyKey: input.idempotencyKey } });
  if (legacy) throw new InventoryError("LEGACY_IDEMPOTENCY_REVIEW_REQUIRED");
  const result = await execute();
  await tx.idempotencyCommand.create({ data: { tenantId: actor.tenantId, commandId: input.idempotencyKey, payloadHash, resultType: type, resultId: result.id, result } });
  return result;
}

export async function receipt(actor: Actor, input: Receipt, clock: Clock) {
  return inventoryTransaction(actor, "inventory.receive", clock, async (tx, verified) => {
    await stockAccess(tx, verified, input);
    return command(tx, verified, "RECEIPT", input, async () => {
      const stock = await level(tx, verified, input);
      await tx.inventoryLevel.update({ where: { id: stock.id }, data: { onHand: { increment: input.quantity } } });
      const movement = await tx.inventoryMovement.create({ data: { tenantId: verified.tenantId, locationId: input.locationId, variantId: input.variantId, lotId: input.lotId,
        quantity: input.quantity, direction: "IN", type: "RECEIPT", actorUserId: verified.userId, reason: input.reason, idempotencyKey: input.idempotencyKey } });
      await audit(tx, verified, "inventory.received", "InventoryMovement", movement.id);
      return { id: movement.id, type: "RECEIPT" };
    });
  });
}

function businessDay(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

async function intake(tx: Tx, actor: Actor, input: SaleInput, shortage: Decimal, day: string,
  registerSessionId: string, intakeValue: string, approved: boolean) {
  if (!actor.permissions.includes("inventory.unverified_intake.create")) throw new InventoryError("FORBIDDEN");
  const policy = await configuredPolicy(tx, actor.tenantId);
  if (policy.mode === "DISABLED") throw new InventoryError("UNVERIFIED_INTAKE_DISABLED");
  if (policy.mode === "REQUIRE_SUPERVISOR" && !approved) throw new InventoryError("SUPERVISOR_APPROVAL_REQUIRED");
  if (shortage.gt(policy.maxLineQuantity.toString())) throw new InventoryError("UNVERIFIED_INTAKE_LINE_CAP");
  const daily = await tx.unverifiedIntakeReview.aggregate({ _sum: { quantity: true }, where: { tenantId: actor.tenantId, variantId: input.variantId, businessDay: day } });
  if (shortage.plus(daily._sum.quantity?.toString() ?? "0").gt(policy?.maxVariantDailyQuantity.toString() ?? "20")) throw new InventoryError("UNVERIFIED_INTAKE_DAILY_CAP");
  const session = await tx.unverifiedIntakeReview.aggregate({ _sum: { quantity: true, intakeValue: true }, where: { tenantId: actor.tenantId, registerSessionId } });
  if (shortage.plus(session._sum.quantity?.toString() ?? "0").gt(policy.maxSessionQuantity.toString())) throw new InventoryError("UNVERIFIED_INTAKE_SESSION_CAP");
  if (new FinancialDecimal(intakeValue).plus(session._sum.intakeValue?.toString() ?? "0").gt(policy.maxSessionValue.toString())) throw new InventoryError("UNVERIFIED_INTAKE_VALUE_CAP");
}

async function serverPrice(tx: Tx, actor: Actor, input: { variantId: string; unitPrice?: string }, branchId: string, now: Date) {
  const price = await tx.price.findFirst({ where: { tenantId: actor.tenantId, variantId: input.variantId, channel: "RETAIL",
    validFrom: { lte: now }, AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }, { OR: [{ branchId }, { branchId: null }] }] },
    orderBy: [{ branchId: { sort: "desc", nulls: "last" } }, { validFrom: "desc" }, { id: "asc" }] });
  if (!price?.currency) throw new InventoryError("PRICE_CURRENCY_REQUIRED");
  assertMoneyPrecision(price.amount.toString(), price.currency);
  if (input.unitPrice !== undefined && !price.amount.equals(input.unitPrice)) throw new InventoryError("PRICE_MISMATCH");
  return { ...price, currency: price.currency };
}

async function storeFiscalContext(tx: Tx, actor: Actor, branchId: string): Promise<FiscalContext | null> {
  const branch = await tx.branch.findFirst({ where: { tenantId: actor.tenantId, id: branchId } });
  const store = branch ? await tx.store.findFirst({ where: { tenantId: actor.tenantId, id: branch.storeId } }) : null;
  const profile = store ? await tx.fiscalProfile.findUnique({ where: { tenantId_storeId: { tenantId: actor.tenantId, storeId: store.id } } }) : null;
  if (!store || !profile) return null;
  return { storeId: store.id, storeName: store.name, country: "AR", condition: profile.condition, internalTicket: profile.internalTicket };
}

type SaleCoreLine = { locationId: string; variantId: string; lotId?: string; quantity: string; unitPrice?: string; reason?: string };
type SaleCoreOptions = { idempotencyKey: string; allowUnverifiedIntake: boolean; approvalToken?: string; clientPrices: boolean; approvalInput: SaleInput | MultiSaleInput };

async function confirmSaleCore(tx: Tx, verified: Actor, now: Date, lines: SaleCoreLine[], options: SaleCoreOptions) {
  const first = lines[0];
  const { location } = await stockAccess(tx, verified, first);
  if (!location.branchId || lines.some((line) => line.locationId !== first.locationId)) throw new InventoryError("SAME_LOCATION_REQUIRED");
  const session = await currentRegisterSession(tx, verified, location.branchId);
  const policy = await configuredPolicy(tx, verified.tenantId);
  const approval = options.approvalToken ? await consume(tx, verified, options.approvalInput, session.id, location.branchId, now) : null;
  const plans: Array<{ line: SaleCoreLine; variant: { name: string }; price: { amount: Decimal; currency: string }; lots: Awaited<ReturnType<typeof tx.lot.findMany>>; levels: Awaited<ReturnType<typeof tx.inventoryLevel.findMany>>; shortage: Decimal; day: string; intakeValue: string }> = [];

  for (const line of lines) {
    const { variant } = await stockAccess(tx, verified, line);
    const price = await serverPrice(tx, verified, options.clientPrices ? line : { variantId: line.variantId }, location.branchId, now);
    if (session.currency !== price.currency || policy.currency !== session.currency) throw new InventoryError("CURRENCY_MISMATCH");
    await tx.$queryRaw`SELECT "id" FROM "InventoryLevel" WHERE "tenantId" = ${verified.tenantId}::uuid
      AND "locationId" = ${line.locationId}::uuid AND "variantId" = ${line.variantId}::uuid
      ORDER BY "locationId", "variantId", "lotId" NULLS LAST FOR UPDATE`;
    const lots = await tx.lot.findMany({ where: { tenantId: verified.tenantId, variantId: line.variantId, ...(line.lotId ? { id: line.lotId } : {}) } });
    if (line.lotId && lots[0]?.expiresAt && lots[0].expiresAt <= now && !approval) throw new InventoryError("EXPIRED_LOT");
    const levels = await tx.inventoryLevel.findMany({ where: { tenantId: verified.tenantId, locationId: line.locationId, variantId: line.variantId,
      ...(line.lotId ? { lotId: line.lotId } : {}) } });
    const usable = levels.filter((stock) => !stock.lotId || lots.some((lot) => lot.id === stock.lotId && (approval || !lot.expiresAt || lot.expiresAt > now)));
    const available = usable.reduce((sum, stock) => sum.plus(stock.onHand.minus(stock.reserved).toString()), new Decimal(0));
    const requested = new Decimal(line.quantity);
    const shortage = Decimal.max(0, requested.minus(available));
    const day = businessDay(now, location.timeZone);
    const intakeValue = money(new FinancialDecimal(shortage.toString()).times(price.amount.toString()), price.currency);
    if (shortage.gt(0)) {
      if (!options.allowUnverifiedIntake) throw new InventoryError("INSUFFICIENT_STOCK");
      if (lots.some((lot) => lot.expiresAt && lot.expiresAt <= now) && !approval) throw new InventoryError("EXPIRED_LOT");
      await intake(tx, verified, { ...line, idempotencyKey: options.idempotencyKey, unitPrice: price.amount.toString(), allowUnverifiedIntake: options.allowUnverifiedIntake }, shortage, day, session.id, intakeValue, approval !== null);
    }
    plans.push({ line, variant, price, lots, levels, shortage, day, intakeValue });
  }

  const total = plans.reduce((sum, plan) => sum.plus(money(new FinancialDecimal(plan.line.quantity).times(plan.price.amount.toString()), plan.price.currency)), new FinancialDecimal(0));
  const fiscalContext = await storeFiscalContext(tx, verified, location.branchId);
  const created = await tx.sale.create({ data: { tenantId: verified.tenantId, locationId: first.locationId, actorUserId: verified.userId, total: money(total, session.currency),
    registerSessionId: session.id, currency: session.currency, createdAt: now, fiscalSnapshot: fiscalContext ? buildFiscalSnapshot(fiscalContext) : undefined,
    lines: { create: plans.map((plan) => ({ tenantId: verified.tenantId, variantId: plan.line.variantId, quantity: plan.line.quantity, unitPrice: plan.price.amount, productName: plan.variant.name })) } }, include: { lines: true } });

  for (const [index, plan] of plans.entries()) {
    const { line, lots, shortage, day, intakeValue } = plan;
    let caseId: string | undefined;
    if (shortage.gt(0)) {
      const target = await level(tx, verified, line);
      await tx.inventoryLevel.update({ where: { id: target.id }, data: { onHand: { increment: shortage.toString() } } });
      const review = await tx.unverifiedIntakeReview.create({ data: { tenantId: verified.tenantId, locationId: line.locationId, variantId: line.variantId, lotId: line.lotId,
        quantity: shortage.toString(), reason: line.reason ?? "Physical stock pending review", createdBy: verified.userId, saleId: created.id, saleLineId: created.lines[index].id,
        sessionId: verified.sessionId, registerSessionId: session.id, intakeValue, currency: session.currency, businessDay: day, createdAt: now } });
      caseId = review.id;
      await tx.inventoryMovement.create({ data: { tenantId: verified.tenantId, locationId: line.locationId, variantId: line.variantId, lotId: line.lotId,
        quantity: shortage.toString(), type: "UNVERIFIED_INTAKE", direction: "IN", referenceId: review.id, caseId, registerSessionId: session.id, actorUserId: verified.userId, reason: line.reason ?? "Physical stock pending review" } });
      await audit(tx, verified, "UNVERIFIED_INTAKE_CREATED", "UnverifiedIntakeReview", review.id, { saleId: created.id, quantity: shortage.toString() });
    }
    const finalLevels = await tx.inventoryLevel.findMany({ where: { tenantId: verified.tenantId, locationId: line.locationId, variantId: line.variantId, ...(line.lotId ? { lotId: line.lotId } : {}) } });
    const allocation = selectFefoLots(finalLevels.map((stock) => ({ lotId: stock.lotId ?? "", available: new Decimal(stock.onHand.minus(stock.reserved).toString()), expiresAt: lots.find((lot) => lot.id === stock.lotId)?.expiresAt ?? null })), new Decimal(line.quantity), now, approval !== null);
    for (const part of allocation) {
      const target = finalLevels.find((stock) => (stock.lotId ?? "") === part.lotId)!;
      const changed = await tx.$executeRaw`UPDATE "InventoryLevel" SET "onHand" = "onHand" - ${part.available.toString()}::decimal
        WHERE "id" = ${target.id}::uuid AND "tenantId" = ${verified.tenantId}::uuid AND "onHand" - "reserved" >= ${part.available.toString()}::decimal`;
      if (changed !== 1) throw new InventoryError("INSUFFICIENT_STOCK");
      await tx.inventoryMovement.create({ data: { tenantId: verified.tenantId, locationId: line.locationId, variantId: line.variantId, lotId: target.lotId,
        quantity: part.available.toString(), direction: "OUT", type: "SALE", referenceId: created.id, caseId: target.lotId === (line.lotId ?? null) ? caseId : undefined,
        registerSessionId: session.id, actorUserId: verified.userId, reason: "Sale" } });
    }
  }
  await audit(tx, verified, "inventory.sale", "Sale", created.id);
  return { id: created.id, type: "SALE", total: money(total, session.currency), currency: session.currency };
}

export async function sale(actor: Actor, input: SaleInput, clock: Clock) {
  return inventoryTransaction(actor, "inventory.sell", clock, async (tx, verified, now) => {
    await stockAccess(tx, verified, input);
    return command(tx, verified, "SALE", input, () => confirmSaleCore(tx, verified, now, [input], { idempotencyKey: input.idempotencyKey, allowUnverifiedIntake: input.allowUnverifiedIntake, approvalToken: input.approvalToken, clientPrices: true, approvalInput: input }));
  });
}

export async function multiSale(actor: Actor, input: MultiSaleInput, clock: Clock) {
  return inventoryTransaction(actor, "inventory.sell", clock, async (tx, verified, now) => {
    for (const line of input.lines) await stockAccess(tx, verified, line);
    return command(tx, verified, "MULTI_SALE", input, () => confirmSaleCore(tx, verified, now, input.lines, { ...input, clientPrices: false, approvalInput: input }));
  });
}


export async function reserve(actor: Actor, input: ReservationInput, clock: Clock) {
  return inventoryTransaction(actor, "inventory.reserve", clock, async (tx, verified, now) => {
    await stockAccess(tx, verified, input);
    return command(tx, verified, "RESERVATION", input, async () => {
      if (input.lotId) {
        const lot = await tx.lot.findFirstOrThrow({ where: { id: input.lotId, tenantId: verified.tenantId } });
        if (lot.expiresAt && lot.expiresAt <= now) throw new InventoryError("EXPIRED_LOT");
      }
      const stock = await level(tx, verified, input);
      const changed = await tx.$executeRaw`UPDATE "InventoryLevel" SET "reserved" = "reserved" + ${input.quantity}::decimal
        WHERE "id" = ${stock.id}::uuid AND "tenantId" = ${verified.tenantId}::uuid AND "onHand" - "reserved" >= ${input.quantity}::decimal`;
      if (changed !== 1) throw new InventoryError("INSUFFICIENT_STOCK");
      const reservation = await tx.reservation.create({ data: { tenantId: verified.tenantId, locationId: input.locationId, variantId: input.variantId,
        lotId: input.lotId, quantity: input.quantity, referenceId: input.referenceId } });
      await audit(tx, verified, "inventory.reserved", "Reservation", reservation.id);
      return { id: reservation.id, type: "RESERVATION" };
    });
  });
}

export async function release(actor: Actor, input: { reservationId: string; idempotencyKey: string }, clock: Clock) {
  return inventoryTransaction(actor, "inventory.reserve", clock, async (tx, verified) => {
    const reservation = await tx.reservation.findFirst({ where: { id: input.reservationId, tenantId: verified.tenantId } });
    if (!reservation) throw new InventoryError("NOT_FOUND");
    await locationAccess(tx, verified, reservation.locationId);
    return command(tx, verified, "RELEASE", input, async () => {
      if (reservation.status !== "ACTIVE") throw new InventoryError("RESERVATION_NOT_ACTIVE");
      const stock = await level(tx, verified, reservation);
      await tx.inventoryLevel.update({ where: { id: stock.id }, data: { reserved: { decrement: reservation.quantity } } });
      await tx.reservation.update({ where: { id: reservation.id }, data: { status: "RELEASED" } });
      await audit(tx, verified, "inventory.released", "Reservation", reservation.id);
      return { id: reservation.id, type: "RELEASE" };
    });
  });
}

export async function review(actor: Actor, input: ReviewInput, clock: Clock) {
  return inventoryTransaction(actor, "inventory.unverified_intake.review", clock, async (tx, verified, now) => {
    const original = await tx.unverifiedIntakeReview.findFirst({ where: { id: input.reviewId, tenantId: verified.tenantId } });
    if (!original) throw new InventoryError("NOT_FOUND");
    await locationAccess(tx, verified, original.locationId);
    return command(tx, verified, "REVIEW", input, async () => {
      if (original.status !== "PENDING_REVIEW") throw new InventoryError("REVIEW_ALREADY_CLOSED");
      if (original.createdBy === verified.userId) throw new InventoryError("SEPARATION_OF_DUTIES");
      const base = { tenantId: verified.tenantId, locationId: original.locationId, variantId: original.variantId, lotId: original.lotId,
        referenceId: original.id, caseId: original.id, registerSessionId: original.registerSessionId, actorUserId: verified.userId, reason: input.reason };
      if (input.decision === "CORRECTED") {
        const variant = await tx.productVariant.findFirstOrThrow({ where: { id: original.variantId, tenantId: verified.tenantId } });
        assertQuantityPrecision(input.correctionQuantity!, variant.quantityPrecision);
        const delta = new Decimal(input.correctionQuantity!).minus(original.quantity.toString());
        if (!delta.isZero()) {
          const stock = await level(tx, verified, original);
          const changed = await tx.$executeRaw`UPDATE "InventoryLevel" SET "onHand" = "onHand" + ${delta.toString()}::decimal
            WHERE "id" = ${stock.id}::uuid AND "tenantId" = ${verified.tenantId}::uuid AND "onHand" + ${delta.toString()}::decimal >= "reserved"`;
          if (changed !== 1) throw new InventoryError("CORRECTION_WOULD_NEGATE_STOCK");
          await tx.inventoryMovement.create({ data: { ...base, quantity: delta.abs().toString(), direction: delta.isPositive() ? "IN" : "OUT", type: "ADJUSTMENT" } });
        }
      }
      if (input.decision === "CONFIRMED") {
        // Reclassify with net-zero compensating entries; never mutate the intake.
        await tx.inventoryMovement.create({ data: { ...base, quantity: original.quantity, direction: "OUT", type: "ADJUSTMENT" } });
        await tx.inventoryMovement.create({ data: { ...base, quantity: original.quantity, direction: "IN", type: "RECEIPT", unitCost: input.unitCost } });
      }
      if (input.decision === "REJECTED") {
        if (!original.saleId || !original.saleLineId || !original.sessionId || !original.registerSessionId) throw new InventoryError("LEGACY_INTAKE_CONTEXT_REQUIRED");
        await tx.inventoryDiscrepancy.create({ data: { tenantId: verified.tenantId, reviewId: original.id, saleId: original.saleId,
          saleLineId: original.saleLineId, sessionId: original.sessionId, registerSessionId: original.registerSessionId, reason: input.reason } });
      }
      await tx.unverifiedIntakeReview.update({ where: { id: original.id }, data: { status: input.decision, correctionQuantity: input.correctionQuantity,
        reviewedBy: verified.userId, reviewedAt: now } });
      await audit(tx, verified, `UNVERIFIED_INTAKE_${input.decision}`, "UnverifiedIntakeReview", original.id,
        { reason: input.reason, previousStatus: original.status, costStatus: input.unitCost === undefined ? "UNKNOWN_ACKNOWLEDGED" : "KNOWN" });
      return { id: original.id, type: "REVIEW" };
    });
  });
}

export async function alerts(actor: Actor, clock: Clock) {
  return inventoryTransaction(actor, "inventory.unverified_intake.review", clock, async (tx, verified, now) => {
    const policy = await tx.unverifiedIntakePolicy.findUnique({ where: { tenantId: verified.tenantId } });
    const days = policy?.reviewAfterDays ?? 7;
    const locations = await tx.location.findMany({ where: { tenantId: verified.tenantId, branchId: { in: [...verified.branchIds] } }, select: { id: true } });
    const where = { tenantId: verified.tenantId, locationId: { in: locations.map(({ id }) => id) } };
    const pending = await tx.unverifiedIntakeReview.findMany({ where: { ...where, status: "PENDING_REVIEW", createdAt: { lt: new Date(now.getTime() - days * 86400000) } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const volumes = await tx.unverifiedIntakeReview.groupBy({ by: ["createdBy", "currency"], where, _count: { _all: true }, _sum: { quantity: true, intakeValue: true } });
    return { alerts: pending.map((review) => ({ type: "UNVERIFIED_INTAKE_OVERDUE", reviewId: review.id, createdAt: review.createdAt.toISOString(),
      quantity: review.quantity.toString(), registerSessionId: review.registerSessionId, thresholdDays: days })),
      intakesByCashier: volumes.map((entry) => ({ cashierId: entry.createdBy, currency: entry.currency, count: entry._count._all,
        quantity: entry._sum.quantity?.toString() ?? "0", value: entry._sum.intakeValue?.toString() ?? null })) };
  });
}
