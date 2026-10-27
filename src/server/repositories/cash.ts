import Decimal from "decimal.js";
import type { Actor } from "../../domain/actor";
import { assertMoneyPrecision, currencyPrecision, FinancialDecimal, money, type PolicyInput } from "../../domain/cash";
import { InventoryError } from "../../domain/inventory";
import { audit, command, inventoryTransaction, type Clock } from "./inventory";
import type { TransactionClient as Tx } from "./tenant-context";

export async function configuredPolicy(tx: Tx, tenantId: string) {
  const policy = await tx.unverifiedIntakePolicy.findUnique({ where: { tenantId } });
  if (!policy?.currency || !policy.maxSessionValue) throw new InventoryError("MONETARY_CONFIGURATION_REQUIRED");
  return { ...policy, currency: policy.currency, maxSessionValue: policy.maxSessionValue };
}

export async function currentRegisterSession(tx: Tx, actor: Actor, branchId: string) {
  const session = await tx.cashRegisterSession.findFirst({ where: { tenantId: actor.tenantId, userId: actor.userId, branchId, closedAt: null } });
  if (!session) throw new InventoryError("REGISTER_SESSION_REQUIRED");
  return session;
}

export async function configure(actor: Actor, input: PolicyInput, clock: Clock) {
  assertMoneyPrecision(input.maxSessionValue, input.currency);
  return inventoryTransaction(actor, "inventory.policy.manage", clock, async (tx, verified) => {
    const open = await tx.cashRegisterSession.findFirst({ where: { tenantId: verified.tenantId, closedAt: null, currency: { not: input.currency } } });
    if (open) throw new InventoryError("OPEN_SESSION_CURRENCY_CONFLICT");
    const policy = await tx.unverifiedIntakePolicy.upsert({ where: { tenantId: verified.tenantId }, create: { tenantId: verified.tenantId, ...input }, update: input });
    await audit(tx, verified, "inventory.policy.configured", "Tenant", verified.tenantId,
      { currency: input.currency, maxSessionValue: input.maxSessionValue, reviewAfterDays: input.reviewAfterDays });
    return { currency: policy.currency, maxSessionValue: policy.maxSessionValue?.toString(), mode: policy.mode, reviewAfterDays: policy.reviewAfterDays };
  });
}

export async function open(actor: Actor, input: { registerId: string; openingAmount?: string; openingReason?: string; idempotencyKey: string }, clock: Clock) {
  return inventoryTransaction(actor, "cash.session.open", clock, async (tx, verified, now) => {
    const register = await tx.cashRegister.findFirst({ where: { tenantId: verified.tenantId, id: input.registerId } });
    if (!register || !verified.branchIds.includes(register.branchId)) throw new InventoryError("NOT_FOUND");
    return command(tx, verified, "CASH_OPEN", input, async () => {
      const policy = await configuredPolicy(tx, verified.tenantId);
      const existing = await tx.cashRegisterSession.findFirst({ where: { tenantId: verified.tenantId, closedAt: null,
        OR: [{ registerId: register.id }, { userId: verified.userId }] } });
      if (existing) throw new InventoryError("REGISTER_SESSION_ALREADY_OPEN");
      const session = await tx.cashRegisterSession.create({ data: { tenantId: verified.tenantId, registerId: register.id,
        branchId: register.branchId, userId: verified.userId, currency: policy.currency, openedAt: now } });
      const openingAmount = input.openingAmount ?? "0";
      assertMoneyPrecision(openingAmount, policy.currency);
      const opening = await tx.cashMovement.create({ data: { tenantId: verified.tenantId, registerSessionId: session.id,
        type: "OPENING", amount: openingAmount, currency: policy.currency, actorUserId: verified.userId,
        reason: input.openingReason ?? "Opening cash", createdAt: now } });
      await audit(tx, verified, "cash.session.opened", "CashRegisterSession", session.id, { registerId: register.id, branchId: register.branchId, openingMovementId: opening.id });
      return { id: session.id, type: "CASH_OPEN", currency: policy.currency };
    });
  });
}

export async function recordMovement(actor: Actor, input: { registerSessionId: string; type: "CASH_IN" | "CASH_OUT"; amount: string; reason: string; referenceId?: string; idempotencyKey: string }, clock: Clock) {
  return inventoryTransaction(actor, "cash.session.close", clock, async (tx, verified, now) => {
    const session = await tx.cashRegisterSession.findFirst({ where: { tenantId: verified.tenantId, id: input.registerSessionId } });
    if (!session || !verified.branchIds.includes(session.branchId)) throw new InventoryError("NOT_FOUND");
    if (session.userId !== verified.userId) throw new InventoryError("FORBIDDEN");
    assertMoneyPrecision(input.amount, session.currency);
    return command(tx, verified, `CASH_${input.type}`, input, async () => {
      if (session.closedAt) throw new InventoryError("REGISTER_SESSION_ALREADY_CLOSED");
      const movement = await tx.cashMovement.create({ data: { tenantId: verified.tenantId, registerSessionId: session.id,
        type: input.type, amount: input.amount, currency: session.currency, actorUserId: verified.userId,
        reason: input.reason, referenceId: input.referenceId, createdAt: now } });
      await audit(tx, verified, `cash.movement.${input.type.toLowerCase()}`, "CashMovement", movement.id, { amount: input.amount, currency: session.currency, reason: input.reason });
      return { id: movement.id, type: input.type, currency: session.currency };
    });
  });
}

async function expectedCash(tx: Tx, tenantId: string, sessionId: string): Promise<Decimal> {
  const movements = await tx.cashMovement.findMany({ where: { tenantId, registerSessionId: sessionId, type: { in: ["OPENING", "CASH_IN", "CASH_OUT"] } } });
  const movementTotal = movements.reduce((total, movement) => total.plus(movement.type === "CASH_OUT" ? new FinancialDecimal(movement.amount.toString()).negated() : movement.amount.toString()), new FinancialDecimal(0));
  const payments = await tx.payment.aggregate({ _sum: { amount: true }, where: { tenantId, method: "CASH", OR: [{ registerSessionId: sessionId }, { sale: { registerSessionId: sessionId } }] } });
  return movementTotal.plus(payments._sum.amount?.toString() ?? "0");
}

export async function closeBlind(actor: Actor, input: { registerSessionId: string; countedCashAmount: string; reason: string; idempotencyKey: string }, clock: Clock) {
  return inventoryTransaction(actor, "cash.session.close", clock, async (tx, verified, now) => {
    const session = await tx.cashRegisterSession.findFirst({ where: { tenantId: verified.tenantId, id: input.registerSessionId } });
    if (!session || !verified.branchIds.includes(session.branchId)) throw new InventoryError("NOT_FOUND");
    if (session.userId !== verified.userId && !verified.permissions.includes("cash.session.close.other")) throw new InventoryError("FORBIDDEN");
    assertMoneyPrecision(input.countedCashAmount, session.currency);
    const previous = await tx.idempotencyCommand.findUnique({ where: { tenantId_commandId: { tenantId: verified.tenantId, commandId: input.idempotencyKey } } });
    const result = await command(tx, verified, "CASH_CLOSE_BLIND", input, async () => {
      if (session.closedAt) throw new InventoryError("REGISTER_SESSION_ALREADY_CLOSED");
      if (now < session.openedAt) throw new InventoryError("INVALID_SESSION_TIME");
      const expected = money(await expectedCash(tx, verified.tenantId, session.id), session.currency);
      const declared = money(input.countedCashAmount, session.currency);
      const difference = new FinancialDecimal(declared).minus(expected).toDecimalPlaces(currencyPrecision(session.currency), Decimal.ROUND_HALF_UP).toFixed(currencyPrecision(session.currency));
      const movement = await tx.cashMovement.create({ data: { tenantId: verified.tenantId, registerSessionId: session.id,
        type: "CLOSING_COUNT", amount: declared, currency: session.currency, actorUserId: verified.userId, reason: input.reason, createdAt: now } });
      await tx.cashRegisterSession.update({ where: { id: session.id }, data: { closedAt: now, closedBy: verified.userId,
        declaredCash: declared, expectedCash: expected, difference } });
      await audit(tx, verified, "cash.session.blind_closed", "CashRegisterSession", session.id,
        { declaredCash: declared, expectedCash: expected, difference, currency: session.currency, reason: input.reason, closingMovementId: movement.id });
      return { id: session.id, type: "CASH_CLOSE_BLIND", currency: session.currency, total: declared };
    });
    if (previous) {
      const closed = await tx.cashRegisterSession.findUniqueOrThrow({ where: { id: session.id } });
      return { id: closed.id, type: "CASH_CLOSE_BLIND", currency: closed.currency, total: closed.declaredCash?.toString() ?? "0",
        declaredCash: closed.declaredCash === null ? undefined : money(closed.declaredCash, closed.currency),
        expectedCash: closed.expectedCash === null ? undefined : money(closed.expectedCash, closed.currency),
        difference: closed.difference === null ? undefined : money(closed.difference, closed.currency) };
    }
    const closed = await tx.cashRegisterSession.findUniqueOrThrow({ where: { id: session.id } });
    return { ...result,
      declaredCash: closed.declaredCash === null ? undefined : money(closed.declaredCash, closed.currency),
      expectedCash: closed.expectedCash === null ? undefined : money(closed.expectedCash, closed.currency),
      difference: closed.difference === null ? undefined : money(closed.difference, closed.currency) };
  });
}

export async function close(actor: Actor, input: { registerSessionId: string; idempotencyKey: string }, clock: Clock) {
  return inventoryTransaction(actor, "cash.session.close", clock, async (tx, verified, now) => {
    const session = await tx.cashRegisterSession.findFirst({ where: { tenantId: verified.tenantId, id: input.registerSessionId } });
    if (!session || !verified.branchIds.includes(session.branchId)) throw new InventoryError("NOT_FOUND");
    if (session.userId !== verified.userId && !verified.permissions.includes("cash.session.close.other")) throw new InventoryError("FORBIDDEN");
    return command(tx, verified, "CASH_CLOSE", input, async () => {
      if (session.closedAt) throw new InventoryError("REGISTER_SESSION_ALREADY_CLOSED");
      if (now < session.openedAt) throw new InventoryError("INVALID_SESSION_TIME");
      await tx.cashRegisterSession.update({ where: { id: session.id }, data: { closedAt: now, closedBy: verified.userId } });
      await audit(tx, verified, "cash.session.closed", "CashRegisterSession", session.id, { registerId: session.registerId, cashierId: session.userId, branchId: session.branchId });
      return { id: session.id, type: "CASH_CLOSE", currency: session.currency };
    });
  });
}
