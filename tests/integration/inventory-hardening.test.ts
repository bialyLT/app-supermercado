import { afterAll, describe, expect, it } from "vitest";
import { confirmSale, recordReceipt, reserveStock, releaseReservation, reviewUnverifiedIntake } from "../../src/server/inventory";
import { createCatalogItem, getCurrentPrice } from "../../src/server/catalog";
import { inventoryTransaction } from "../../src/server/repositories/inventory";
import { admin, runtime, fixture, addActor, clock, enabled, reconcile } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); await runtime.$disconnect(); });
(enabled ? describe : describe.skip)("inventory adversarial regression", () => {
  it.each(["40001", "40P01"])("retries real SQLSTATE %s without partial writes, at most three times", async (code) => {
    const f = await fixture();
    let attempts = 0;
    await inventoryTransaction(f.actor, "inventory.receive", clock, async (tx) => {
      attempts += 1;
      await tx.auditLog.create({ data: { tenantId: f.tenantId, actorUserId: f.actor.userId, action: "retry_fixture", entityType: "Gate" } });
      if (attempts < 3) await tx.$executeRawUnsafe(`DO $$ BEGIN RAISE EXCEPTION 'retry fixture' USING ERRCODE = '${code}'; END $$`);
    });
    expect(attempts).toBe(3);
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "retry_fixture" } })).toBe(1);
    attempts = 0;
    await expect(inventoryTransaction(f.actor, "inventory.receive", clock, async (tx) => {
      attempts += 1;
      await tx.$executeRawUnsafe(`DO $$ BEGIN RAISE EXCEPTION 'retry fixture' USING ERRCODE = '${code}'; END $$`);
    })).rejects.toThrow("retry fixture");
    expect(attempts).toBe(3);
  });
  it("requires a real unexpired session and rejects forged roles and tenants", async () => {
    const f = await fixture("CASHIER");
    const input = { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "seed" };
    await expect(recordReceipt({ ...f.actor, sessionId: undefined }, input, clock)).rejects.toThrow("UNAUTHENTICATED");
    await expect(recordReceipt({ ...f.actor, role: "ADMIN", permissions: ["inventory.write"] }, input, clock)).rejects.toThrow("FORBIDDEN");
    const other = await fixture();
    await expect(recordReceipt({ ...f.actor, tenantId: other.tenantId }, input, clock)).rejects.toThrow("UNAUTHENTICATED");
    await admin.session.update({ where: { id: f.actor.sessionId }, data: { expiresAt: new Date("2000-01-01T00:00:00Z") } });
    await expect(recordReceipt(f.actor, input, clock)).rejects.toThrow("UNAUTHENTICATED");
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("denies each operation for insufficient persisted permissions and audits denials", async () => {
    const f = await fixture("CASHIER");
    await expect(recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "seed" }, clock)).rejects.toThrow("FORBIDDEN");
    await expect(reserveStock(f.actor, { ...f.stock, quantity: "1", idempotencyKey: "reserve" }, clock)).rejects.toThrow("FORBIDDEN");
    await expect(releaseReservation(f.actor, { reservationId: crypto.randomUUID(), idempotencyKey: "release" }, clock)).rejects.toThrow("FORBIDDEN");
    await expect(reviewUnverifiedIntake(f.actor, { reviewId: crypto.randomUUID(), decision: "REJECTED", reason: "test", idempotencyKey: "review" }, clock)).rejects.toThrow("FORBIDDEN");
    await expect(createCatalogItem(f.actor, { sku: "denied", name: "Test", unitCode: "u", unitName: "Unit" })).rejects.toThrow("FORBIDDEN");
    const manager = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
    await expect(confirmSale(manager, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "sale" }, clock)).rejects.toThrow("FORBIDDEN");
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "inventory.denied" } })).toBe(5);
  });

  it("caps denial audit volume at ten entries per actor per minute", async () => {
    const f = await fixture("CASHIER");
    await Promise.all(Array.from({ length: 15 }, (_, i) => recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "denied", idempotencyKey: `${i}` }, clock).catch(() => undefined)));
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "inventory.denied" } })).toBe(10);
  });

  it("rejects authority fields in payloads and enforces quantity precision", async () => {
    const f = await fixture();
    const injected = { ...f.stock, quantity: "1", reason: "test", idempotencyKey: "seed", tenantId: f.tenantId, role: "ADMIN" };
    await expect(recordReceipt(f.actor, injected, clock)).rejects.toThrow();
    for (const quantity of ["0", "-1", "0.001", "1.0001", "NaN"]) {
      await expect(recordReceipt(f.actor, { ...f.stock, quantity, reason: "bad", idempotencyKey: quantity }, clock)).rejects.toThrow();
    }
    await admin.productVariant.update({ where: { id: f.variantId }, data: { quantityPrecision: 3 } });
    await recordReceipt(f.actor, { ...f.stock, quantity: "0.001", reason: "weighed", idempotencyKey: "weighed" }, clock);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("returns the same 404 for foreign, absent and unauthorized branch resources", async () => {
    const a = await fixture();
    const b = await fixture();
    const input = { ...a.stock, quantity: "1", reason: "test", idempotencyKey: "test" };
    await expect(recordReceipt(a.actor, { ...input, locationId: b.locationId }, clock)).rejects.toThrow("NOT_FOUND");
    await expect(recordReceipt(a.actor, { ...input, locationId: crypto.randomUUID() }, clock)).rejects.toThrow("NOT_FOUND");
    await expect(recordReceipt(a.actor, { ...input, variantId: b.variantId }, clock)).rejects.toThrow("NOT_FOUND");
    await admin.userBranch.deleteMany({ where: { userId: a.actor.userId } });
    await expect(recordReceipt({ ...a.actor, branchIds: [a.branchId] }, input, clock)).rejects.toThrow("NOT_FOUND");
    expect(await admin.inventoryMovement.count({ where: { tenantId: a.tenantId } })).toBe(0);
  });

  it("deduplicates five sales and rejects every changed payload dimension", async () => {
    const f = await fixture("ADMIN", { unitPrice: "10" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "5", reason: "seed", idempotencyKey: "seed" }, clock);
    const input = { ...f.stock, quantity: "1", unitPrice: "10", idempotencyKey: "sale" };
    const first = await confirmSale(f.actor, input, clock);
    for (let i = 0; i < 5; i += 1) expect(await confirmSale(f.actor, { ...input, quantity: "1.000", unitPrice: "10.00" }, clock)).toEqual(first);
    for (const change of [{ quantity: "2" }, { unitPrice: "11" }, { reason: "changed" }, { allowUnverifiedIntake: true }])
      await expect(confirmSale(f.actor, { ...input, ...change }, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const second = await admin.productVariant.create({ data: { tenantId: f.tenantId, productId: f.productId, unitId: f.unitId, sku: "second", name: "Second" } });
    await expect(confirmSale(f.actor, { ...input, variantId: second.id }, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const location = await admin.location.create({ data: { tenantId: f.tenantId, branchId: f.branchId, code: "second", name: "Second" } });
    await expect(confirmSale(f.actor, { ...input, locationId: location.id }, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const lot = await admin.lot.create({ data: { tenantId: f.tenantId, variantId: f.variantId, lotNumber: "other" } });
    await expect(confirmSale(f.actor, { ...input, lotId: lot.id }, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "different operation", idempotencyKey: "sale" }, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("replays the same command after authentication session renewal", async () => {
    const f = await fixture();
    const input = { ...f.stock, quantity: "1", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "sale" };
    const first = await confirmSale(f.actor, input, clock);
    const session = await admin.session.create({ data: { userId: f.actor.userId, token: crypto.randomUUID(), expiresAt: new Date("2030-01-01T00:00:00Z") } });
    expect(await confirmSale({ ...f.actor, sessionId: session.id }, input, clock)).toEqual(first);
  });

  it("never executes an old ledger command again when its hash is unavailable", async () => {
    const f = await fixture();
    await recordReceipt(f.actor, { ...f.stock, quantity: "5", reason: "seed", idempotencyKey: "seed" }, clock);
    await admin.inventoryMovement.create({ data: { tenantId: f.tenantId, ...f.stock, quantity: "1", type: "SALE", direction: "OUT", idempotencyKey: "legacy-sale" } });
    const level = await admin.inventoryLevel.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    await admin.inventoryLevel.update({ where: { id: level.id }, data: { onHand: "4" } });
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "legacy-sale" }, clock)).rejects.toThrow("LEGACY_IDEMPOTENCY_REVIEW_REQUIRED");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("allocates FEFO across lots and ignores expired stock", async () => {
    const f = await fixture();
    const definitions = [["late", "2027-12-01"], ["early", "2026-11-01"], ["expired", "2020-01-01"]] as const;
    const lots: { id: string }[] = [];
    for (const [lotNumber, date] of definitions) {
      const lot = await admin.lot.create({ data: { tenantId: f.tenantId, variantId: f.variantId, lotNumber, expiresAt: new Date(`${date}T00:00:00Z`) } });
      lots.push(lot);
      await recordReceipt(f.actor, { ...f.stock, lotId: lot.id, quantity: "2", reason: "lot", idempotencyKey: lotNumber }, clock);
    }
    await confirmSale(f.actor, { ...f.stock, quantity: "3", unitPrice: "1", idempotencyKey: "sale" }, clock);
    const levels = await admin.inventoryLevel.findMany({ where: { tenantId: f.tenantId } });
    expect(levels.find((level) => level.lotId === lots[0].id)?.onHand.toString()).toBe("1");
    expect(levels.find((level) => level.lotId === lots[1].id)?.onHand.toString()).toBe("0");
    expect(levels.find((level) => level.lotId === lots[2].id)?.onHand.toString()).toBe("2");
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "2", unitPrice: "1", idempotencyKey: "short", allowUnverifiedIntake: true }, clock)).rejects.toThrow("EXPIRED_LOT");
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("rolls back insufficient stock and invalid reservations without partial data", async () => {
    const f = await fixture();
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "sale" }, clock)).rejects.toThrow("INSUFFICIENT_STOCK");
    await expect(reserveStock(f.actor, { ...f.stock, quantity: "1", idempotencyKey: "reserve" }, clock)).rejects.toThrow("INSUFFICIENT_STOCK");
    await expect(releaseReservation(f.actor, { reservationId: crypto.randomUUID(), idempotencyKey: "release" }, clock)).rejects.toThrow("NOT_FOUND");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.inventoryLevel.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.idempotencyCommand.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("does not sell reserved stock", async () => {
    const f = await fixture();
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "seed" }, clock);
    const reservation = await reserveStock(f.actor, { ...f.stock, quantity: "2", idempotencyKey: "reserve" }, clock);
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "sale" }, clock)).rejects.toThrow("INSUFFICIENT_STOCK");
    await releaseReservation(f.actor, { reservationId: reservation.id, idempotencyKey: "release" }, clock);
    await expect(releaseReservation(f.actor, { reservationId: reservation.id, idempotencyKey: "other-release" }, clock)).rejects.toThrow("RESERVATION_NOT_ACTIVE");
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it.each(["DISABLED", "REQUIRE_SUPERVISOR"] as const)("fails closed for policy %s", async (mode) => {
    const f = await fixture();
    await admin.unverifiedIntakePolicy.update({ where: { tenantId: f.tenantId }, data: { mode } });
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "sale" }, clock)).rejects.toThrow(mode === "DISABLED" ? "UNVERIFIED_INTAKE_DISABLED" : "SUPERVISOR_APPROVAL_REQUIRED");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it.each(["line", "daily", "session"] as const)("enforces the %s cap atomically", async (cap) => {
    const f = await fixture();
    await admin.unverifiedIntakePolicy.update({ where: { tenantId: f.tenantId }, data: { maxLineQuantity: cap === "line" ? "1" : "100", maxVariantDailyQuantity: cap === "daily" ? "1" : "100", maxSessionQuantity: cap === "session" ? "1" : "100" } });
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "2", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "sale" }, clock)).rejects.toThrow(`UNVERIFIED_INTAKE_${cap === "line" ? "LINE" : cap === "daily" ? "DAILY" : "SESSION"}_CAP`);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.unverifiedIntakeReview.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it.each(["CONFIRMED", "CORRECTED", "REJECTED"] as const)("reviews as %s with separation, immutable outcome and exact ledger", async (decision) => {
    const f = await fixture();
    await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "sale" }, clock);
    const original = await admin.unverifiedIntakeReview.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    const input = { reviewId: original.id, decision, reason: "verified", idempotencyKey: "review", correctionQuantity: decision === "CORRECTED" ? "2" : undefined, acknowledgeUnknownCost: true };
    await expect(reviewUnverifiedIntake(f.actor, input, clock)).rejects.toThrow("SEPARATION_OF_DUTIES");
    const reviewer = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
    const before = await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } });
    const result = await reviewUnverifiedIntake(reviewer, input, clock);
    expect(await reviewUnverifiedIntake(reviewer, input, clock)).toEqual(result);
    await expect(reviewUnverifiedIntake(reviewer, { ...input, idempotencyKey: "again" }, clock)).rejects.toThrow("REVIEW_ALREADY_CLOSED");
    const updated = await admin.unverifiedIntakeReview.findUniqueOrThrow({ where: { id: original.id } });
    expect(updated.status).toBe(decision);
    expect(updated.quantity.toString()).toBe("1");
    if (decision === "REJECTED") {
      expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(before);
      const discrepancy = await admin.inventoryDiscrepancy.findFirstOrThrow({ where: { tenantId: f.tenantId } });
      expect(discrepancy.saleLineId).toBe(original.saleLineId);
      expect(discrepancy.sessionId).toBe(f.actor.sessionId);
    }
    await expect(admin.unverifiedIntakeReview.update({ where: { id: original.id }, data: { reason: "tamper" } })).rejects.toThrow("INTAKE_REVIEW_IMMUTABLE");
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("rejects invalid/negative corrections and supports explicit known cost confirmation", async () => {
    const f = await fixture();
    const reviewer = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
    await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "sale" }, clock);
    const original = await admin.unverifiedIntakeReview.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    const base = { reviewId: original.id, reason: "verify", idempotencyKey: "review" };
    await expect(reviewUnverifiedIntake(reviewer, { ...base, decision: "CORRECTED" }, clock)).rejects.toThrow("CORRECTION_REQUIRED");
    await expect(reviewUnverifiedIntake(reviewer, { ...base, decision: "CONFIRMED" }, clock)).rejects.toThrow("COST_ACKNOWLEDGEMENT_REQUIRED");
    await expect(reviewUnverifiedIntake(reviewer, { ...base, decision: "CORRECTED", correctionQuantity: "0" }, clock)).rejects.toThrow("CORRECTION_WOULD_NEGATE_STOCK");
    await reviewUnverifiedIntake(reviewer, { ...base, decision: "CONFIRMED", unitCost: "5.00" }, clock);
    const receipt = await admin.inventoryMovement.findFirstOrThrow({ where: { tenantId: f.tenantId, type: "RECEIPT" } });
    expect(receipt.unitCost?.toString()).toBe("5");
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("creates catalog in tenant scope and permits barcode reuse only across tenants", async () => {
    const a = await fixture();
    const b = await fixture();
    const input = { sku: "new", name: "Catalog", unitCode: "kg", unitName: "Kilogram", barcode: "12345678", price: "12.34" };
    const item = await createCatalogItem(a.actor, input);
    const other = await createCatalogItem(b.actor, input);
    expect(other.tenantId).not.toBe(item.tenantId);
    expect(await getCurrentPrice(a.actor, { variantId: item.variants[0].id })).toBe("12.34");
    expect(await getCurrentPrice(b.actor, { variantId: item.variants[0].id })).toBeNull();
    await expect(createCatalogItem(a.actor, { ...input, sku: "duplicate-barcode" })).rejects.toThrow();
    await expect(getCurrentPrice(a.actor, { variantId: item.variants[0].id, branchId: b.branchId })).rejects.toThrow("NOT_FOUND");
  });
});
