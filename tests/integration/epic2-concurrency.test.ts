import { afterAll, describe, expect, it } from "vitest";
import { confirmSale, recordReceipt, releaseReservation, reserveStock } from "../../src/server/inventory";
import { admin, clock, enabled, fixture, reconcile } from "./fixtures";

afterAll(() => admin.$disconnect());
(enabled ? describe : describe.skip)("Epic 2 PostgreSQL concurrency — 20 consecutive rounds", () => {
  for (let round = 1; round <= 20; round += 1) {
    it(`round ${round}: 20 sales, exact ledger and no partial effects`, async () => {
      const f = await fixture("ADMIN", { unitPrice: "10" });
      await recordReceipt(f.actor, { ...f.stock, quantity: "5", reason: "concurrency fixture", idempotencyKey: "seed" }, clock);
      const sales = await Promise.all(Array.from({ length: 20 }, (_, index) => confirmSale(f.actor, {
        ...f.stock, quantity: "1", unitPrice: "10.00", allowUnverifiedIntake: true, idempotencyKey: `sale-${index}`,
      }, clock)));
      expect(new Set(sales.map((sale) => sale.id)).size).toBe(20);
      const level = await admin.inventoryLevel.findFirstOrThrow({ where: { tenantId: f.tenantId } });
      expect(level.onHand.toString()).toBe("0");
      expect(level.reserved.toString()).toBe("0");
      const movements = await admin.inventoryMovement.findMany({ where: { tenantId: f.tenantId } });
      expect(movements.filter((movement) => movement.type === "SALE")).toHaveLength(20);
      expect(movements.filter((movement) => movement.type === "UNVERIFIED_INTAKE")).toHaveLength(15);
      for (const intake of movements.filter((movement) => movement.type === "UNVERIFIED_INTAKE")) {
        expect(intake.caseId).not.toBeNull();
        expect(movements.filter((movement) => movement.type === "SALE" && movement.caseId === intake.caseId)).toHaveLength(1);
      }
      expect(movements).toHaveLength(36);
      expect(await admin.unverifiedIntakeReview.count({ where: { tenantId: f.tenantId, status: "PENDING_REVIEW" } })).toBe(15);
      expect(await admin.saleLine.count({ where: { tenantId: f.tenantId } })).toBe(20);
      expect(await admin.idempotencyCommand.count({ where: { tenantId: f.tenantId } })).toBe(21);
      expect(await reconcile(f.tenantId)).toHaveLength(0);
    }, 30000);
  }

  it("concurrent identical commands have exactly one effect", async () => {
    const f = await fixture();
    const input = { ...f.stock, quantity: "1", reason: "duplicate", idempotencyKey: "same" };
    const results = await Promise.all(Array.from({ length: 20 }, () => recordReceipt(f.actor, input, clock)));
    expect(new Set(results.map((result) => result.id)).size).toBe(1);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("concurrent reservations and releases never reserve or release twice", async () => {
    const f = await fixture();
    await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "seed" }, clock);
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => reserveStock(f.actor, { ...f.stock, quantity: "1", idempotencyKey: `reserve-${index}` }, clock)));
    const successes = results.filter((result) => result.status === "fulfilled");
    expect(successes).toHaveLength(1);
    const reservation = await admin.reservation.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    const releases = await Promise.all(Array.from({ length: 20 }, () => releaseReservation(f.actor, { reservationId: reservation.id, idempotencyKey: "release" }, clock)));
    expect(new Set(releases.map((result) => result.id)).size).toBe(1);
    const level = await admin.inventoryLevel.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    expect(level.onHand.toString()).toBe("1");
    expect(level.reserved.toString()).toBe("0");
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });
});
