import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Actor } from "../../domain/actor";
import { approvalTtlMs, maxPinFailures, pinLockMs, type ApprovalInput } from "../../domain/approval";
import { InventoryError, type MultiSaleInput, type SaleInput } from "../../domain/inventory";
import { audit, inventoryPermissions, inventoryTransaction, locationAccess, type Clock } from "./inventory";
import { currentRegisterSession } from "./cash";
import type { TransactionClient as Tx } from "./tenant-context";

function derive(pin: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(pin, salt, 64,
    { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${(await derive(pin, salt)).toString("hex")}`;
}
async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const parts = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(hash);
  if (!parts) return false;
  return timingSafeEqual(await derive(pin, parts[1]), Buffer.from(parts[2], "hex"));
}
function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function approvalCommandHash(input: SaleInput | MultiSaleInput): string {
  const target = "lines" in input
    ? { ...input, lines: input.lines.map((line) => { const canonicalLine = { ...line }; delete canonicalLine.unitPrice; return canonicalLine; }) }
    : { ...input };
  delete target.approvalToken;
  return createHash("sha256").update(JSON.stringify({ operation: "inventory.sale", input: target })).digest("hex");
}

async function approver(tx: Tx, tenantId: string, userId: string, branchId: string) {
  const user = await tx.user.findFirst({ where: { tenantId, id: userId, active: true },
    include: { roles: { include: { role: true } }, branches: { where: { branchId } } } });
  if (!user || !user.branches.length || !user.roles.some(({ role }) => inventoryPermissions[role.name].includes("inventory.sale.approve")))
    throw new InventoryError("NOT_FOUND");
  return user;
}

export async function setPin(actor: Actor, pin: string, clock: Clock) {
  await inventoryTransaction(actor, "identity.supervisor_pin.manage", clock, async () => undefined);
  // Hash outside the DB lock; never store low-entropy PINs in a command payload hash.
  const pinHash = await hashPin(pin);
  return inventoryTransaction(actor, "identity.supervisor_pin.manage", clock, async (tx, verified) => {
    await tx.supervisorCredential.upsert({ where: { tenantId_userId: { tenantId: verified.tenantId, userId: verified.userId } },
      create: { tenantId: verified.tenantId, userId: verified.userId, pinHash }, update: { pinHash, failedAttempts: 0, lockedUntil: null } });
    await audit(tx, verified, "supervisor.pin.changed", "User", verified.userId);
    return { userId: verified.userId };
  });
}

export async function issue(actor: Actor, input: ApprovalInput, clock: Clock) {
  const result = await inventoryTransaction(actor, "inventory.sell", clock, async (tx, verified, now) => {
    const location = await locationAccess(tx, verified, input.sale.locationId);
    const session = await currentRegisterSession(tx, verified, location.branchId!);
    if (input.approverUserId === verified.userId) throw new InventoryError("SEPARATION_OF_DUTIES");
    await approver(tx, verified.tenantId, input.approverUserId, location.branchId!);
    const variant = await tx.productVariant.findFirst({ where: { tenantId: verified.tenantId, id: input.sale.variantId, active: true } });
    if (!variant) throw new InventoryError("NOT_FOUND");
    const credential = await tx.supervisorCredential.findUnique({ where: { tenantId_userId: { tenantId: verified.tenantId, userId: input.approverUserId } } });
    if (!credential) throw new InventoryError("NOT_FOUND");
    if (credential.lockedUntil && credential.lockedUntil > now) return { error: "SUPERVISOR_PIN_LOCKED" } as const;
    const recent = await tx.supervisorApproval.count({ where: { tenantId: verified.tenantId, requesterId: verified.userId, createdAt: { gt: new Date(now.getTime() - 60000) } } });
    if (recent >= 10) return { error: "SUPERVISOR_PIN_LOCKED" } as const;
    if (!await verifyPin(input.pin, credential.pinHash)) {
      const attempts = credential.lockedUntil && credential.lockedUntil <= now ? 1 : credential.failedAttempts + 1;
      await tx.supervisorCredential.update({ where: { tenantId_userId: { tenantId: verified.tenantId, userId: credential.userId } },
        data: { failedAttempts: attempts, lockedUntil: attempts >= maxPinFailures ? new Date(now.getTime() + pinLockMs) : null } });
      await audit(tx, verified, "supervisor.pin.denied", "User", credential.userId, { requesterId: verified.userId, approverId: credential.userId });
      // Return the denial so the attempt/lockout commit; throwing here would roll them back.
      return { error: attempts >= maxPinFailures ? "SUPERVISOR_PIN_LOCKED" : "SUPERVISOR_PIN_INVALID" } as const;
    }
    await tx.supervisorCredential.update({ where: { tenantId_userId: { tenantId: verified.tenantId, userId: credential.userId } }, data: { failedAttempts: 0, lockedUntil: null } });
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(now.getTime() + approvalTtlMs);
    const approval = await tx.supervisorApproval.create({ data: { tenantId: verified.tenantId, registerSessionId: session.id,
      requesterId: verified.userId, approverId: credential.userId, commandHash: approvalCommandHash(input.sale), tokenHash: tokenHash(token),
      reason: input.reason, createdAt: now, expiresAt } });
    await audit(tx, verified, "supervisor.approval.issued", "SupervisorApproval", approval.id,
      { requesterId: verified.userId, approverId: credential.userId, registerSessionId: session.id, locationId: input.sale.locationId, variantId: input.sale.variantId, reason: input.reason });
    return { token, expiresAt: expiresAt.toISOString(), approvalId: approval.id };
  });
  if ("error" in result) throw new InventoryError(result.error!);
  return result;
}

export async function consume(tx: Tx, actor: Actor, input: SaleInput | MultiSaleInput, registerSessionId: string, branchId: string, now: Date) {
  if (!input.approvalToken) throw new InventoryError("SUPERVISOR_APPROVAL_REQUIRED");
  const approval = await tx.supervisorApproval.findUnique({ where: { tenantId_tokenHash: { tenantId: actor.tenantId, tokenHash: tokenHash(input.approvalToken) } } });
  if (!approval || approval.requesterId !== actor.userId || approval.registerSessionId !== registerSessionId || approval.commandHash !== approvalCommandHash(input))
    throw new InventoryError("INVALID_SUPERVISOR_APPROVAL");
  if (approval.consumedAt) throw new InventoryError("SUPERVISOR_APPROVAL_USED");
  if (approval.expiresAt <= now) throw new InventoryError("SUPERVISOR_APPROVAL_EXPIRED");
  await approver(tx, actor.tenantId, approval.approverId, branchId);
  const changed = await tx.supervisorApproval.updateMany({ where: { tenantId: actor.tenantId, id: approval.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
  if (changed.count !== 1) throw new InventoryError("SUPERVISOR_APPROVAL_USED");
  await audit(tx, actor, "supervisor.approval.consumed", "SupervisorApproval", approval.id,
    { requesterId: actor.userId, approverId: approval.approverId, registerSessionId, operation: "inventory.sale", reason: approval.reason });
  return approval;
}
