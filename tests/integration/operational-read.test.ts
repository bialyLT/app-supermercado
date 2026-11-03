import { afterAll, describe, expect, it } from "vitest";
import { recordCashMovement } from "../../src/server/cash";
import { confirmSale, recordReceipt } from "../../src/server/inventory";
import {
  getSale,
  listCashShifts,
  listInventoryLevels,
  listInventoryMovements,
  listSales,
  operationalReadQuerySchema,
} from "../../src/server/operational-read";
import { addActor, admin, clock, enabled, fixture } from "./fixtures";

afterAll(() => admin.$disconnect());
describe("operational read query schema", () => {
  it("validates optional filters and rejects inverted date ranges", () => {
    expect(operationalReadQuerySchema.parse({}).limit).toBe(50);
    expect(operationalReadQuerySchema.parse({ from: "2026-10-26T00:00:00.000Z" }).from).toBe("2026-10-26T00:00:00.000Z");
    expect(operationalReadQuerySchema.safeParse({
      from: "2026-10-27T00:00:00.000Z",
      to: "2026-10-26T00:00:00.000Z",
    }).success).toBe(false);
  });
});

(enabled ? describe : describe.skip)("operational read services", () => {
  it("returns tenant-scoped levels, movements, sales, and cash shifts", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    const lot = await admin.lot.create({ data: {
      tenantId: f.tenantId,
      variantId: f.variantId,
      lotNumber: "readable-lot",
      expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    } });
    await recordReceipt(f.actor, { ...f.stock, quantity: "3", reason: "Unlotted stock", idempotencyKey: "unlotted" }, clock);
    await recordReceipt(f.actor, { ...f.stock, lotId: lot.id, quantity: "2", reason: "Lotted stock", idempotencyKey: "lotted" }, clock);
    const sale = await confirmSale(f.actor, {
      ...f.stock,
      lotId: lot.id,
      quantity: "1",
      unitPrice: "2.50",
      allowUnverifiedIntake: false,
      idempotencyKey: "read-sale",
    }, clock);
    await recordCashMovement(f.actor, {
      registerSessionId: f.registerSessionId!,
      type: "CASH_IN",
      amount: "5.00",
      reason: "Read fixture",
      idempotencyKey: "read-cash-in",
    }, clock);

    const query = { limit: 100 };
    const levels = await listInventoryLevels(f.actor, query);
    expect(levels.levels).toHaveLength(2);
    expect(levels.levels.map(({ onHand, lot: rowLot }) => ({ onHand, lotNumber: rowLot?.lotNumber ?? null })))
      .toEqual(expect.arrayContaining([
        { onHand: "3", lotNumber: null },
        { onHand: "1", lotNumber: "readable-lot" },
      ]));

    const movements = await listInventoryMovements(f.actor, query);
    expect(movements.movements.map(({ direction, quantityDelta, lot: rowLot }) => ({ direction, quantityDelta, hasLot: rowLot !== null })))
      .toEqual(expect.arrayContaining([
        { direction: "IN", quantityDelta: "3", hasLot: false },
        { direction: "IN", quantityDelta: "2", hasLot: true },
        { direction: "OUT", quantityDelta: "-1", hasLot: true },
      ]));

    const sales = await listSales(f.actor, query);
    expect(sales.sales).toHaveLength(1);
    expect(sales.sales[0]).toMatchObject({ id: sale.id, total: "2.5", lineCount: 1, paymentCount: 0 });
    expect(await getSale(f.actor, sale.id)).toMatchObject({ id: sale.id, total: "2.5", lines: [{ quantity: "1", unitPrice: "2.5" }], payments: [] });

    const shifts = await listCashShifts(f.actor, query);
    expect(shifts.shifts).toHaveLength(1);
    expect(shifts.shifts[0]).toMatchObject({
      id: f.registerSessionId,
      closedAt: null,
      declaredCash: null,
      expectedCash: null,
      difference: null,
      movements: [{ type: "CASH_IN", amount: "5", reason: "Read fixture" }],
    });
  });

  it("limits non-admin reads to assigned branches and hides sales outside the tenant", async () => {
    const f = await fixture();
    await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "Branch scope", idempotencyKey: "branch-stock" }, clock);
    const sale = await confirmSale(f.actor, {
      ...f.stock,
      quantity: "1",
      unitPrice: "1",
      allowUnverifiedIntake: false,
      idempotencyKey: "branch-read-sale",
    }, clock);
    const manager = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
    const foreign = await fixture("ADMIN");

    const assigned = await listInventoryLevels(manager, { limit: 100, branchId: f.branchId });
    expect(assigned.levels).toHaveLength(1);
    await expect(listInventoryLevels(manager, { limit: 100, branchId: crypto.randomUUID() })).rejects.toThrow("FORBIDDEN");
    expect((await listSales(foreign.actor, { limit: 100 })).sales).toHaveLength(0);
    await expect(getSale(foreign.actor, sale.id)).rejects.toThrow("NOT_FOUND");
  });
});
