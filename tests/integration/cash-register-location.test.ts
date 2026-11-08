import { afterAll, describe, expect, it } from "vitest";
import { assignCashRegisterLocation, closeRegisterSession, getPosSessionLocation, openRegisterSession } from "../../src/server/cash";
import { confirmPaidMultiLineSale, confirmSale, recordReceipt } from "../../src/server/inventory";
import { admin, runtime, fixture, addActor, clock, enabled, reconcile } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); await runtime.$disconnect(); });

(enabled ? describe : describe.skip)("cash register active location assignment", () => {
  it("opening a register without an assigned active location fails closed", async () => {
    const f = await fixture("CASHIER", { cashSession: false, unassignedRegister: true });
    await expect(openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: "unassigned-open" }, clock)).rejects.toThrow("REGISTER_LOCATION_REQUIRED");
    expect(await admin.cashRegisterSession.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("ADMIN assigns same-branch active location; open snapshots it and remaps apply to the next shift only", async () => {
    const f = await fixture("CASHIER", { cashSession: false, unassignedRegister: true });
    const adminActor = await addActor(f.tenantId, f.branchId, "ADMIN");
    const assigned = await assignCashRegisterLocation(adminActor, { registerId: f.registerId, locationId: f.locationId }, clock);
    expect(assigned).toMatchObject({ registerId: f.registerId, locationId: f.locationId });
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "cash.register.location.assigned" } })).toBe(1);

    const opened = await openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: "open-1" }, clock);
    const session = await admin.cashRegisterSession.findUniqueOrThrow({ where: { id: opened.id } });
    expect(session.locationId).toBe(f.locationId);

    const other = await admin.location.create({ data: { tenantId: f.tenantId, branchId: f.branchId, code: "other", name: "Other" } });
    await assignCashRegisterLocation(adminActor, { registerId: f.registerId, locationId: other.id }, clock);
    const still = await admin.cashRegisterSession.findUniqueOrThrow({ where: { id: opened.id } });
    expect(still.locationId).toBe(f.locationId);

    await closeRegisterSession(f.actor, { registerSessionId: opened.id, idempotencyKey: "close-1" }, clock);
    const reopened = await openRegisterSession(f.actor, { registerId: f.registerId, idempotencyKey: "open-2" }, clock);
    const next = await admin.cashRegisterSession.findUniqueOrThrow({ where: { id: reopened.id } });
    expect(next.locationId).toBe(other.id);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("allows tenant-wide ADMIN to map only active same-branch locations", async () => {
    const f = await fixture("ADMIN", { cashSession: false, unassignedRegister: true });
    await admin.userBranch.deleteMany({ where: { tenantId: f.tenantId, userId: f.actor.userId } });

    async function expectNoAssignmentEffects() {
      const register = await admin.cashRegister.findUniqueOrThrow({ where: { id: f.registerId } });
      expect(register.locationId).toBeNull();
      expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "cash.register.location.assigned" } })).toBe(0);
    }

    const foreign = await fixture("ADMIN", { cashSession: false, unassignedRegister: true });
    await expect(assignCashRegisterLocation(f.actor, { registerId: f.registerId, locationId: foreign.locationId }, clock)).rejects.toThrow("NOT_FOUND");
    await expectNoAssignmentEffects();

    const branch2 = await admin.branch.create({ data: { tenantId: f.tenantId, storeId: f.storeId, code: "tenant-wide-branch", name: "Other branch" } });
    const otherBranchLocation = await admin.location.create({ data: {
      tenantId: f.tenantId, branchId: branch2.id, code: "tenant-wide-other", name: "Other branch location",
    } });
    await expect(assignCashRegisterLocation(f.actor, { registerId: f.registerId, locationId: otherBranchLocation.id }, clock)).rejects.toThrow("NOT_FOUND");
    await expectNoAssignmentEffects();

    const inactive = await admin.location.create({ data: {
      tenantId: f.tenantId, branchId: f.branchId, code: "tenant-wide-inactive", name: "Inactive location", active: false,
    } });
    await expect(assignCashRegisterLocation(f.actor, { registerId: f.registerId, locationId: inactive.id }, clock)).rejects.toThrow("NOT_FOUND");
    await expectNoAssignmentEffects();

    const assigned = await assignCashRegisterLocation(f.actor, { registerId: f.registerId, locationId: f.locationId }, clock);
    expect(assigned).toMatchObject({ registerId: f.registerId, locationId: f.locationId });
    const register = await admin.cashRegister.findUniqueOrThrow({ where: { id: f.registerId } });
    expect(register.locationId).toBe(f.locationId);
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "cash.register.location.assigned" } })).toBe(1);
  });

  it("denies assignment to cashier, supervisor and stock manager without mutation", async () => {
    const f = await fixture("ADMIN", { unassignedRegister: true });
    for (const role of ["CASHIER", "SUPERVISOR", "STOCK_MANAGER"] as const) {
      const actor = await addActor(f.tenantId, f.branchId, role);
      await expect(assignCashRegisterLocation(actor, { registerId: f.registerId, locationId: f.locationId }, clock)).rejects.toThrow("FORBIDDEN");
    }
    const register = await admin.cashRegister.findUniqueOrThrow({ where: { id: f.registerId } });
    expect(register.locationId).toBeNull();
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "cash.register.location.assigned" } })).toBe(0);
  });

  it("rejects cross-tenant, cross-branch and inactive locations with no mutation", async () => {
    const f = await fixture("ADMIN", { unassignedRegister: true });
    const foreign = await fixture("ADMIN", { unassignedRegister: true });
    await expect(assignCashRegisterLocation(f.actor, { registerId: f.registerId, locationId: foreign.locationId }, clock)).rejects.toThrow("NOT_FOUND");

    const branch2 = await admin.branch.create({ data: { tenantId: f.tenantId, storeId: f.storeId, code: "b2", name: "Branch 2" } });
    const elsewhere = await admin.location.create({ data: { tenantId: f.tenantId, branchId: branch2.id, code: "elsewhere", name: "Elsewhere" } });
    await expect(assignCashRegisterLocation(f.actor, { registerId: f.registerId, locationId: elsewhere.id }, clock)).rejects.toThrow("NOT_FOUND");

    await admin.location.update({ where: { id: f.locationId }, data: { active: false } });
    await expect(assignCashRegisterLocation(f.actor, { registerId: f.registerId, locationId: f.locationId }, clock)).rejects.toThrow("NOT_FOUND");

    const register = await admin.cashRegister.findUniqueOrThrow({ where: { id: f.registerId } });
    expect(register.locationId).toBeNull();
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "cash.register.location.assigned" } })).toBe(0);
  });

  it("rejects tampered checkout locations with no sale or stock side-effect", async () => {
    const f = await fixture("CASHIER", { unitPrice: "2.50" });
    const adminActor = await addActor(f.tenantId, f.branchId, "ADMIN");
    await recordReceipt(adminActor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "seed-tamper" }, clock);
    const elsewhere = await admin.location.create({ data: { tenantId: f.tenantId, branchId: f.branchId, code: "tamper", name: "Tamper" } });
    await expect(confirmPaidMultiLineSale(f.actor, {
      idempotencyKey: "tampered",
      lines: [{ ...f.stock, locationId: elsewhere.id, quantity: "1" }],
      payments: [{ method: "CASH", amount: "2.50" }],
    }, clock)).rejects.toThrow("REGISTER_LOCATION_MISMATCH");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await reconcile(f.tenantId)).toHaveLength(0);

    const result = await confirmPaidMultiLineSale(f.actor, {
      idempotencyKey: "legit",
      lines: [{ ...f.stock, quantity: "1" }],
      payments: [{ method: "CASH", amount: "2.50" }],
    }, clock);
    expect(result).toMatchObject({ type: "SALE", total: "2.50", currency: "XTS" });
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("keeps a legacy NULL-snapshot session fail-closed for sales", async () => {
    const f = await fixture("CASHIER", { unitPrice: "1", unassignedRegister: true });
    expect(f.registerSessionId).toBeDefined();
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "legacy-sale" }, clock)).rejects.toThrow("REGISTER_LOCATION_REQUIRED");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("resolves POS context from the open-session snapshot for cashier and supervisor", async () => {
    const f = await fixture("CASHIER");
    expect(await getPosSessionLocation(f.actor, clock)).toEqual({ locationId: f.locationId });

    const supervisor = await addActor(f.tenantId, f.branchId, "SUPERVISOR");
    await expect(getPosSessionLocation(supervisor, clock)).rejects.toThrow("REGISTER_LOCATION_REQUIRED");
    const second = await admin.cashRegister.create({ data: { tenantId: f.tenantId, branchId: f.branchId, name: "Gate register 2", locationId: f.locationId } });
    await openRegisterSession(supervisor, { registerId: second.id, idempotencyKey: "sup-open" }, clock);
    expect(await getPosSessionLocation(supervisor, clock)).toEqual({ locationId: f.locationId });

    const stockManager = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
    await expect(getPosSessionLocation(stockManager, clock)).rejects.toThrow("FORBIDDEN");

    const u = await fixture("CASHIER", { cashSession: false, unassignedRegister: true });
    await expect(getPosSessionLocation(u.actor, clock)).rejects.toThrow("REGISTER_LOCATION_REQUIRED");
  });
});
