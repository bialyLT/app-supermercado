import type { Actor } from "../../domain/actor";
import { assertMoneyPrecision, type PolicyInput } from "../../domain/cash";
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

export async function open(actor: Actor, input: { registerId: string; idempotencyKey: string }, clock: Clock) {
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
      await audit(tx, verified, "cash.session.opened", "CashRegisterSession", session.id, { registerId: register.id, branchId: register.branchId });
      return { id: session.id, type: "CASH_OPEN", currency: policy.currency };
    });
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
