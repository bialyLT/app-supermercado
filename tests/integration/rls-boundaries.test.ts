import { afterAll, describe, expect, it } from "vitest";
import { admin, runtime, enabled, fixture, clock, addActor, now } from "./fixtures";
import { recordReceipt, confirmPaidMultiLineSale, confirmSale, reserveStock, reviewUnverifiedIntake } from "../../src/server/inventory";
import { recordCashMovement } from "../../src/server/cash";
import { upsertWeighedBarcodeConfig } from "../../src/server/repositories/catalog";
import { closeBranchDocuments } from "../../src/server/numbering";
import { reverseSale } from "../../src/server/reversal";
import { setSupervisorPin, approveInventorySale } from "../../src/server/supervisor";
import { createDirectPurchaseReceipt, createSupplier } from "../../src/server/purchases";
import { createTransfer } from "../../src/server/transfers";

async function populatedFixture() {
  const f = await fixture();
  const category = await admin.productCategory.create({ data: { tenantId: f.tenantId, code: "rls-category", name: "RLS category" } });
  await admin.product.update({ where: { id: f.productId }, data: { categoryId: category.id } });
  await upsertWeighedBarcodeConfig(f.actor, { prefix: "20", mode: "PRICE", variantDigits: 5, valueDigits: 5, valueScale: 2 });
  await recordCashMovement(f.actor, { registerSessionId: f.registerSessionId!, type: "CASH_IN", amount: "1", reason: "RLS population", idempotencyKey: `cash-population-${f.tenantId}` }, clock);
  await admin.cashRegister.create({ data: { tenantId: f.tenantId, branchId: f.branchId, name: "Gate" } });
  await admin.barcode.create({ data: { tenantId: f.tenantId, variantId: f.variantId, code: "12345" } });
  const lot = await admin.lot.create({ data: { tenantId: f.tenantId, variantId: f.variantId, lotNumber: "gate" } });
  await recordReceipt(f.actor, { ...f.stock, lotId: lot.id, quantity: "1", reason: "seed", idempotencyKey: "seed" }, clock);
  await confirmSale(f.actor, { ...f.stock, lotId: lot.id, quantity: "2", unitPrice: "1", allowUnverifiedIntake: true, idempotencyKey: "sale" }, clock);
  const intake = await admin.unverifiedIntakeReview.findFirstOrThrow({ where: { tenantId: f.tenantId } });
  const reviewer = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
  await reviewUnverifiedIntake(reviewer, { reviewId: intake.id, decision: "REJECTED", reason: "Gate discrepancy", idempotencyKey: "review" }, clock);
  await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "no-lot" }, clock);
  await reserveStock(f.actor, { ...f.stock, quantity: "1", idempotencyKey: "reservation" }, clock);
  await confirmPaidMultiLineSale(f.actor, { lines: [{ ...f.stock, quantity: "1", unitPrice: "1" }], payments: [{ method: "CASH", amount: "1" }], allowUnverifiedIntake: true, idempotencyKey: "paid-gate" }, clock);
  const supervisor = await addActor(f.tenantId, f.branchId, "SUPERVISOR");
  await setSupervisorPin(supervisor, { pin: "963852" }, clock);
  await approveInventorySale(f.actor, { approverUserId: supervisor.userId, pin: "963852", reason: "Gate fixture",
    sale: { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "approved-gate" } }, clock);
  const reversalSale = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "reversal-gate", allowUnverifiedIntake: true }, clock);
  const reversalLine = await admin.saleLine.findFirstOrThrow({ where: { saleId: reversalSale.id } });
  await reverseSale(f.actor, { saleId: reversalSale.id, type: "ANNULMENT", lines: [{ saleLineId: reversalLine.id, quantity: "1" }], reason: "RLS population", idempotencyKey: "reversal-gate-reverse" }, clock);
  // W4 population on an isolated second branch so the main-branch fixture cash
  // (seed movements plus an annulment CASH_OUT) never affects closure balance.
  const branch2 = await admin.branch.create({ data: { tenantId: f.tenantId, storeId: f.storeId, code: "gate-2", name: "Gate branch 2" } });
  const actor2 = await addActor(f.tenantId, branch2.id, "ADMIN");
  const location2 = await admin.location.create({ data: { tenantId: f.tenantId, branchId: branch2.id, code: "l2", name: "Location 2" } });
  const register2 = await admin.cashRegister.create({ data: { tenantId: f.tenantId, branchId: branch2.id, name: "Gate register 2" } });
  await admin.cashRegisterSession.create({ data: { tenantId: f.tenantId, registerId: register2.id,
    branchId: branch2.id, userId: actor2.userId, currency: "XTS", openedAt: now } });
  await recordReceipt(actor2, { locationId: location2.id, variantId: f.variantId, quantity: "2", reason: "seed", idempotencyKey: "rls-w4-receipt" }, clock);
  await confirmPaidMultiLineSale(actor2, { lines: [{ locationId: location2.id, variantId: f.variantId, quantity: "2", unitPrice: "1" }],
    payments: [{ method: "CASH", amount: "2" }], allowUnverifiedIntake: false, idempotencyKey: "rls-w4-sale" }, clock);
  await closeBranchDocuments(actor2, { branchId: branch2.id, currency: "XTS", reason: "RLS population", idempotencyKey: `close-${f.tenantId}` }, clock);
  await admin.promotion.create({ data: { tenantId: f.tenantId, categoryId: category.id, name: "RLS promotion", n: 2, m: 1 } });
  const supplier = await createSupplier(f.actor, { code: "RLS-SUPPLIER", name: "RLS Supplier" });
  await createDirectPurchaseReceipt(f.actor, {
    supplierId: supplier.id, branchId: f.branchId, locationId: f.locationId, currency: "XTS",
    idempotencyKey: `rls-purchase-${f.tenantId}`, subtotal: "2.00", total: "2.00",
    lines: [{ variantId: f.variantId, quantity: "2", unitCost: "1.00" }],
  }, clock);
  await admin.userBranch.create({ data: { tenantId: f.tenantId, userId: actor2.userId, branchId: f.branchId } });
  await createTransfer({ ...actor2, branchIds: [branch2.id, f.branchId] }, {
    originBranchId: f.branchId, destinationBranchId: branch2.id, originLocationId: f.locationId,
    destinationLocationId: location2.id, idempotencyKey: `rls-transfer-${f.tenantId}`,
    lines: [{ variantId: f.variantId, quantity: "1" }],
  }, clock);
  return f;
}

afterAll(async () => { await admin.$disconnect(); await runtime.$disconnect(); });
(enabled ? describe : describe.skip)("runtime RLS and append-only boundaries", () => {
  // Each probe populates and checks every tenant table through real PostgreSQL transactions.
  it("isolates every tenant table, including identity metadata", { timeout: 20000 }, async () => {
    const a = await fixture();
    const b = await populatedFixture();
    const tables = await admin.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenantId' ORDER BY table_name`;
    expect(tables.length).toBeGreaterThanOrEqual(29);
    await runtime.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${a.tenantId}, true)`;
      for (const { table_name: table } of tables) {
        const total = await admin.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM "${table.replaceAll('"', '""')}" WHERE "tenantId" = $1::uuid`, b.tenantId);
        expect(total[0]?.count, `${table} populated`).toBeGreaterThan(BigInt(0));
        // Identifiers originate exclusively from PostgreSQL's catalog, never an API input.
        const rows = await tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) FROM "${table.replaceAll('"', '""')}" WHERE "tenantId" = $1::uuid`, b.tenantId);
        expect(rows[0]?.count, table).toBe(BigInt(0));
      }
    });
    const settings = await runtime.$queryRaw<{ tenant: string | null }[]>`SELECT NULLIF(current_setting('app.tenant_id', true), '') AS tenant`;
    expect(settings[0]?.tenant).toBeNull();
  });

  it("blocks cross-tenant inserts and mutations in every tenant table", { timeout: 20000 }, async () => {
    const a = await fixture();
    const b = await populatedFixture();
    const tables = await admin.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenantId'`;
    for (const { table_name: table } of tables) {
      const identifier = `"${table.replaceAll('"', '""')}"`;
      await runtime.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${a.tenantId}, true)`;
        const deleted = await tx.$executeRawUnsafe(`UPDATE ${identifier} SET "tenantId" = "tenantId" WHERE "tenantId" = $1::uuid`, b.tenantId).catch(() => -1);
        // Append-only tables reject the statement by privilege; other tables see zero rows.
        expect([0, -1]).toContain(deleted);
      });
      // A complete copied row proves rejection by RLS, not missing required columns.
      const samples = await admin.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM ${identifier} WHERE "tenantId" = $1::uuid LIMIT 1`, b.tenantId);
      expect(samples.length, `${table} populated`).toBe(1);
      if (samples.length) {
        if ("id" in samples[0]) samples[0].id = crypto.randomUUID();
        await expect(runtime.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${a.tenantId}, true)`;
          await tx.$executeRawUnsafe(`INSERT INTO ${identifier} SELECT * FROM jsonb_populate_record(NULL::${identifier}, $1::jsonb)`, JSON.stringify(samples[0]));
        })).rejects.toThrow(/row-level security|permission denied/);
      }
    }
  });

  it("rejects ledger/audit UPDATE DELETE and TRUNCATE with runtime, and triggers reject owner mutations", async () => {
    const f = await fixture();
    await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "seed" }, clock);
    await recordCashMovement(f.actor, { registerSessionId: f.registerSessionId!, type: "CASH_IN", amount: "1", reason: "RLS seed", idempotencyKey: "cash-seed" }, clock);
    await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "reversal seed", idempotencyKey: "reversal-seed" }, clock);
    const reversalSale = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "reversal-seed-sale", allowUnverifiedIntake: false }, clock);
    const reversalLine = await admin.saleLine.findFirstOrThrow({ where: { saleId: reversalSale.id } });
    await reverseSale(f.actor, { saleId: reversalSale.id, type: "ANNULMENT", lines: [{ saleLineId: reversalLine.id, quantity: "1" }], reason: "RLS reversal seed", idempotencyKey: "reversal-seed-reverse" }, clock);
    // Seeds exactly one closure row: sale 1.00 minus annulment 1.00 nets to zero
    // against CASH_IN 1.00 minus the reversal CASH_OUT 1.00.
    await closeBranchDocuments(f.actor, { branchId: f.branchId, currency: "XTS", reason: "RLS seed", idempotencyKey: "rls-closure-seed" }, clock);
    for (const table of ["InventoryMovement", "AuditLog", "CashMovement", "SaleReversal", "SaleReversalLine", "DocumentClosure"]) {
      for (const statement of [`UPDATE "${table}" SET "tenantId" = "tenantId" WHERE "tenantId" = $1::uuid`, `DELETE FROM "${table}" WHERE "tenantId" = $1::uuid`]) {
        await expect(runtime.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${f.tenantId}, true)`;
          await tx.$executeRawUnsafe(statement, f.tenantId);
        })).rejects.toThrow();
        await expect(admin.$executeRawUnsafe(statement, f.tenantId)).rejects.toThrow("APPEND_ONLY");
      }
      await expect(runtime.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)).rejects.toThrow();
    }
    // Sequence rows advance only forward through the allocator: rewinds and
    // deletes fail for both roles, enforced by trigger on top of grants.
    for (const statement of [`UPDATE "DocumentSequence" SET "lastNumber" = "lastNumber" - 1 WHERE "tenantId" = $1::uuid`, `DELETE FROM "DocumentSequence" WHERE "tenantId" = $1::uuid`]) {
      await expect(runtime.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${f.tenantId}, true)`;
        await tx.$executeRawUnsafe(statement, f.tenantId);
      })).rejects.toThrow(/DOCUMENT_SEQUENCE_PROTECTED|permission denied/);
      await expect(admin.$executeRawUnsafe(statement, f.tenantId)).rejects.toThrow("DOCUMENT_SEQUENCE_PROTECTED");
    }
    await expect(runtime.$executeRawUnsafe(`TRUNCATE TABLE "DocumentSequence" CASCADE`)).rejects.toThrow();
  });
});
