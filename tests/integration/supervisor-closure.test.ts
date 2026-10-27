import { afterAll, describe, expect, it } from "vitest";
import { approveInventorySale, setSupervisorPin } from "../../src/server/supervisor";
import { confirmSale, recordReceipt } from "../../src/server/inventory";
import { configureInventoryPolicy, openRegisterSession, closeRegisterSession } from "../../src/server/cash";
import { admin, fixture, addActor, clock, now, enabled, reconcile } from "./fixtures";

const syntheticPin = "849267";
async function setup(expired = false) {
  const f = await fixture("CASHIER");
  const supervisor = await addActor(f.tenantId, f.branchId, "SUPERVISOR");
  const manager = await addActor(f.tenantId, f.branchId, "ADMIN");
  await setSupervisorPin(supervisor, { pin: syntheticPin }, clock);
  const lot = expired ? await admin.lot.create({ data: { tenantId: f.tenantId, variantId: f.variantId, lotNumber: "expired", expiresAt: new Date("2020-01-01T00:00:00Z") } }) : null;
  const stock = { ...f.stock, ...(lot ? { lotId: lot.id } : {}) };
  if (lot) await recordReceipt(manager, { ...stock, quantity: "1", reason: "expired stock", idempotencyKey: "seed" }, clock);
  const sale = { ...stock, quantity: "1", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "sale" };
  return { ...f, supervisor, manager, sale };
}

afterAll(() => admin.$disconnect());
(enabled ? describe : describe.skip)("supervisor step-up closure", () => {
  it("stores only a salted scrypt hash and denies PIN enrollment to a cashier", async () => {
    const f = await setup();
    const credential = await admin.supervisorCredential.findUniqueOrThrow({ where: { tenantId_userId: { tenantId: f.tenantId, userId: f.supervisor.userId } } });
    expect(credential.pinHash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(credential.pinHash).not.toContain(syntheticPin);
    await expect(setSupervisorPin(f.actor, { pin: syntheticPin }, clock)).rejects.toThrow("FORBIDDEN");
    await expect(setSupervisorPin(f.supervisor, { pin: "123" }, clock)).rejects.toThrow();
  });

  it("authorizes an expired lot only through one-use approval and audits both actors without secrets", async () => {
    const f = await setup(true);
    await expect(confirmSale(f.actor, f.sale, clock)).rejects.toThrow("EXPIRED_LOT");
    const approval = await approveInventorySale(f.actor, { approverUserId: f.supervisor.userId, pin: syntheticPin, reason: "Verified exception", sale: f.sale }, clock);
    const input = { ...f.sale, approvalToken: approval.token };
    const result = await confirmSale(f.actor, input, clock);
    for (let i = 0; i < 5; i += 1) expect(await confirmSale(f.actor, input, clock)).toEqual(result);
    const rows = await admin.auditLog.findMany({ where: { tenantId: f.tenantId } });
    const consumed = rows.filter((row) => row.action === "supervisor.approval.consumed");
    expect(consumed).toHaveLength(1);
    expect(consumed[0].newValue).toMatchObject({ requesterId: f.actor.userId, approverId: f.supervisor.userId });
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(syntheticPin);
    expect(serialized).not.toContain(approval.token);
    expect(serialized).not.toContain("scrypt$");
    expect(await reconcile(f.tenantId)).toHaveLength(0);
    await expect(admin.supervisorApproval.update({ where: { id: approval.approvalId }, data: { reason: "tamper" } })).rejects.toThrow("SUPERVISOR_APPROVAL_IMMUTABLE");
  });

  it("uses approved expired stock without unverified intake and consumes approval", async () => {
    const f = await setup(true);
    const sale = { ...f.sale, allowUnverifiedIntake: false };
    const approval = await approveInventorySale(f.actor, { approverUserId: f.supervisor.userId, pin: syntheticPin, reason: "Approved expired stock", sale }, clock);
    const result = await confirmSale(f.actor, { ...sale, approvalToken: approval.token }, clock);
    expect(result).toMatchObject({ type: "SALE", total: "1.00", currency: "XTS" });
    expect((await admin.supervisorApproval.findUniqueOrThrow({ where: { id: approval.approvalId } })).consumedAt).not.toBeNull();
    expect(await admin.unverifiedIntakeReview.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("binds approval to payload and requester, and expires at 90 seconds", async () => {
    const f = await setup(true);
    const approval = await approveInventorySale(f.actor, { approverUserId: f.supervisor.userId, pin: syntheticPin, reason: "Bound exception", sale: f.sale }, clock);
    await expect(confirmSale(f.actor, { ...f.sale, idempotencyKey: "changed", approvalToken: approval.token }, clock)).rejects.toThrow("INVALID_SUPERVISOR_APPROVAL");
    await expect(confirmSale(f.actor, { ...f.sale, quantity: "2", approvalToken: approval.token }, clock)).rejects.toThrow("INVALID_SUPERVISOR_APPROVAL");
    const later = { now: () => new Date(now.getTime() + 90000) };
    await expect(confirmSale(f.actor, { ...f.sale, approvalToken: approval.token }, later)).rejects.toThrow("SUPERVISOR_APPROVAL_EXPIRED");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("does not permit self approval, absent approvers or cross-tenant approval", async () => {
    const f = await setup();
    const input = { approverUserId: f.actor.userId, pin: syntheticPin, reason: "Denied", sale: f.sale };
    await expect(approveInventorySale(f.actor, input, clock)).rejects.toThrow("SEPARATION_OF_DUTIES");
    await expect(approveInventorySale(f.actor, { ...input, approverUserId: crypto.randomUUID() }, clock)).rejects.toThrow("NOT_FOUND");
    const foreign = await fixture("SUPERVISOR");
    await setSupervisorPin(foreign.actor, { pin: syntheticPin }, clock);
    await expect(approveInventorySale(f.actor, { ...input, approverUserId: foreign.actor.userId }, clock)).rejects.toThrow("NOT_FOUND");
  });

  it("persists five failed attempts, locks even a correct PIN, and unlocks after fifteen minutes", async () => {
    const f = await setup();
    const input = { approverUserId: f.supervisor.userId, pin: "000000", reason: "Attempt", sale: f.sale };
    for (let i = 1; i <= 5; i += 1)
      await expect(approveInventorySale(f.actor, input, clock)).rejects.toThrow(i === 5 ? "SUPERVISOR_PIN_LOCKED" : "SUPERVISOR_PIN_INVALID");
    await expect(approveInventorySale(f.actor, { ...input, pin: syntheticPin }, clock)).rejects.toThrow("SUPERVISOR_PIN_LOCKED");
    const credential = await admin.supervisorCredential.findUniqueOrThrow({ where: { tenantId_userId: { tenantId: f.tenantId, userId: f.supervisor.userId } } });
    expect(credential.failedAttempts).toBe(5);
    const later = { now: () => new Date(now.getTime() + 15 * 60000) };
    expect((await approveInventorySale(f.actor, { ...input, pin: syntheticPin }, later)).token).toBeTruthy();
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "supervisor.pin.denied" } })).toBe(5);
  });

  it("rolls token consumption back with a rejected monetary cap and succeeds once after valid configuration", async () => {
    const f = await setup();
    await configureInventoryPolicy(f.manager, { mode: "REQUIRE_SUPERVISOR", currency: "XTS", maxSessionValue: "1" }, clock);
    const sale = { ...f.sale, quantity: "2" };
    await expect(confirmSale(f.actor, sale, clock)).rejects.toThrow("SUPERVISOR_APPROVAL_REQUIRED");
    const approval = await approveInventorySale(f.actor, { approverUserId: f.supervisor.userId, pin: syntheticPin, reason: "Supervised intake", sale }, clock);
    await expect(confirmSale(f.actor, { ...sale, approvalToken: approval.token }, clock)).rejects.toThrow("UNVERIFIED_INTAKE_VALUE_CAP");
    expect((await admin.supervisorApproval.findUniqueOrThrow({ where: { id: approval.approvalId } })).consumedAt).toBeNull();
    await configureInventoryPolicy(f.manager, { mode: "REQUIRE_SUPERVISOR", currency: "XTS", maxSessionValue: "3" }, clock);
    await confirmSale(f.actor, { ...sale, approvalToken: approval.token }, clock);
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("allows at most one matching effect among twenty parallel token uses", async () => {
    const f = await setup(true);
    const approval = await approveInventorySale(f.actor, { approverUserId: f.supervisor.userId, pin: syntheticPin, reason: "One use", sale: f.sale }, clock);
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => confirmSale(f.actor,
      { ...f.sale, idempotencyKey: i === 0 ? f.sale.idempotencyKey : `other-${i}`, approvalToken: approval.token }, clock)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  }, 30000);

  it("rejects an approval after the approver loses branch authorization", async () => {
    const f = await setup(true);
    const approval = await approveInventorySale(f.actor, { approverUserId: f.supervisor.userId, pin: syntheticPin, reason: "Revalidated approver", sale: f.sale }, clock);
    await admin.userBranch.deleteMany({ where: { userId: f.supervisor.userId } });
    await expect(confirmSale(f.actor, { ...f.sale, approvalToken: approval.token }, clock)).rejects.toThrow("NOT_FOUND");
    expect((await admin.supervisorApproval.findUniqueOrThrow({ where: { id: approval.approvalId } })).consumedAt).toBeNull();
  });

  it("rejects tokens used by another requester or moved into a new cash session", async () => {
    const f = await setup(true);
    const approval = await approveInventorySale(f.actor, { approverUserId: f.supervisor.userId, pin: syntheticPin, reason: "Session-bound", sale: f.sale }, clock);
    const other = await addActor(f.tenantId, f.branchId, "CASHIER");
    const register = await admin.cashRegister.create({ data: { tenantId: f.tenantId, branchId: f.branchId, name: "Second register" } });
    await openRegisterSession(other, { registerId: register.id, idempotencyKey: "other-open" }, clock);
    await expect(confirmSale(other, { ...f.sale, approvalToken: approval.token }, clock)).rejects.toThrow("INVALID_SUPERVISOR_APPROVAL");
    await closeRegisterSession(f.actor, { registerSessionId: f.registerSessionId!, idempotencyKey: "close" }, clock);
    await openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: "new-open" }, clock);
    await expect(confirmSale(f.actor, { ...f.sale, approvalToken: approval.token }, clock)).rejects.toThrow("INVALID_SUPERVISOR_APPROVAL");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("rejects unknown and already-consumed tokens without creating a sale", async () => {
    const f = await setup(true);
    await expect(confirmSale(f.actor, { ...f.sale, approvalToken: "f".repeat(64) }, clock)).rejects.toThrow("INVALID_SUPERVISOR_APPROVAL");
    const approval = await approveInventorySale(f.actor, { approverUserId: f.supervisor.userId, pin: syntheticPin, reason: "Consumed fixture", sale: f.sale }, clock);
    await admin.supervisorApproval.update({ where: { id: approval.approvalId }, data: { consumedAt: now } });
    await expect(confirmSale(f.actor, { ...f.sale, approvalToken: approval.token }, clock)).rejects.toThrow("SUPERVISOR_APPROVAL_USED");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("rate-limits issuance even with a valid PIN and handles corrupted hashes as denials", async () => {
    const f = await setup();
    const input = { approverUserId: f.supervisor.userId, pin: syntheticPin, reason: "Rate fixture", sale: f.sale };
    for (let i = 0; i < 10; i += 1) await approveInventorySale(f.actor, input, clock);
    await expect(approveInventorySale(f.actor, input, clock)).rejects.toThrow("SUPERVISOR_PIN_LOCKED");
    expect(await admin.supervisorApproval.count({ where: { tenantId: f.tenantId } })).toBe(10);
    await admin.supervisorCredential.update({ where: { tenantId_userId: { tenantId: f.tenantId, userId: f.supervisor.userId } }, data: { pinHash: "damaged-fixture" } });
    const later = { now: () => new Date(now.getTime() + 61000) };
    await expect(approveInventorySale(f.actor, input, later)).rejects.toThrow("SUPERVISOR_PIN_INVALID");
  });
});
