import { afterAll, describe, expect, it } from "vitest";
import { listCashRegisterOptions } from "../../src/server/cash";
import { addActor, admin, clock, enabled, fixture, runtime } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); await runtime.$disconnect(); });

(enabled ? describe : describe.skip)("cash shift register options", () => {
  it("uses persisted tenant/branch scope and includes registers regardless of opening availability", async () => {
    const f = await fixture("CASHIER", { cashSession: false, unassignedRegister: true });
    const secondBranch = await admin.branch.create({ data: {
      tenantId: f.tenantId, storeId: f.storeId, code: "second", name: "Second branch",
    } });
    const secondLocation = await admin.location.create({ data: {
      tenantId: f.tenantId, branchId: secondBranch.id, code: "front", name: "Front desk",
    } });
    const secondRegister = await admin.cashRegister.create({ data: {
      tenantId: f.tenantId, branchId: secondBranch.id, name: "Second register", locationId: secondLocation.id,
    } });
    const unauthorizedBranch = await admin.branch.create({ data: {
      tenantId: f.tenantId, storeId: f.storeId, code: "unassigned", name: "Unassigned branch",
    } });
    const unauthorizedRegister = await admin.cashRegister.create({ data: {
      tenantId: f.tenantId, branchId: unauthorizedBranch.id, name: "Unauthorized register",
    } });
    await admin.userBranch.create({ data: { tenantId: f.tenantId, userId: f.actor.userId, branchId: secondBranch.id } });
    await admin.cashRegisterSession.create({ data: {
      tenantId: f.tenantId, registerId: secondRegister.id, branchId: secondBranch.id,
      locationId: secondLocation.id, userId: f.actor.userId, currency: "XTS", openedAt: clock.now(),
    } });
    const foreign = await fixture("CASHIER", { cashSession: false });

    // Client-supplied scope is deliberately wrong; the persisted assignments win.
    const result = await listCashRegisterOptions({ ...f.actor, branchIds: [foreign.branchId] }, clock);

    expect(result.registers).toHaveLength(2);
    expect(result.registers.some((register) => register.id === foreign.registerId)).toBe(false);
    expect(result.registers.some((register) => register.id === unauthorizedRegister.id)).toBe(false);
    expect(new Set(result.registers.map((register) => register.branchId))).toEqual(new Set([f.branchId, secondBranch.id]));
    expect(result.registers.find((register) => register.id === f.registerId)).toEqual({
      id: f.registerId,
      name: "Gate register",
      branchId: f.branchId,
      branchCode: "gate",
      branchName: "Gate branch",
      locationId: null,
      locationCode: null,
      locationName: null,
    });
    // An already-open register remains visible; POST retains its existing rejection behavior.
    expect(result.registers.find((register) => register.id === secondRegister.id)).toEqual({
      id: secondRegister.id,
      name: "Second register",
      branchId: secondBranch.id,
      branchCode: "second",
      branchName: "Second branch",
      locationId: secondLocation.id,
      locationCode: "front",
      locationName: "Front desk",
    });
  });

  it("allows existing open-session roles, denies STOCK_MANAGER, and never falls back to tenant-wide ADMIN options", async () => {
    const f = await fixture("SUPERVISOR", { cashSession: false });
    const adminActor = await addActor(f.tenantId, f.branchId, "ADMIN");
    const stockManager = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");

    for (const actor of [f.actor, adminActor]) {
      const result = await listCashRegisterOptions(actor, clock);
      expect(result.registers.map((register) => register.id)).toEqual([f.registerId]);
    }
    await expect(listCashRegisterOptions(stockManager, clock)).rejects.toThrow("FORBIDDEN");

    await admin.userBranch.deleteMany({ where: { tenantId: f.tenantId, userId: adminActor.userId } });
    await expect(listCashRegisterOptions(adminActor, clock)).resolves.toEqual({ registers: [] });
  });
});
