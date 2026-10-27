import { afterAll, describe, expect, it } from "vitest";
import { admin, runtime, enabled, fixture, clock, addActor } from "./fixtures";
import { recordReceipt, confirmPaidMultiLineSale, confirmSale, reserveStock, reviewUnverifiedIntake } from "../../src/server/inventory";
import { recordCashMovement } from "../../src/server/cash";
import { setSupervisorPin, approveInventorySale } from "../../src/server/supervisor";

async function populatedFixture() {
  const f = await fixture();
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
  return f;
}

afterAll(async () => { await admin.$disconnect(); await runtime.$disconnect(); });
(enabled ? describe : describe.skip)("runtime RLS and append-only boundaries", () => {
  it("isolates every tenant table, including identity metadata", async () => {
    const a = await fixture();
    const b = await populatedFixture();
    const tables = await admin.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenantId' ORDER BY table_name`;
    expect(tables.length).toBeGreaterThanOrEqual(27);
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

  it("blocks cross-tenant inserts and mutations in every tenant table", async () => {
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
    for (const table of ["InventoryMovement", "AuditLog", "CashMovement"]) {
      for (const statement of [`UPDATE "${table}" SET "tenantId" = "tenantId" WHERE "tenantId" = $1::uuid`, `DELETE FROM "${table}" WHERE "tenantId" = $1::uuid`]) {
        await expect(runtime.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${f.tenantId}, true)`;
          await tx.$executeRawUnsafe(statement, f.tenantId);
        })).rejects.toThrow();
        await expect(admin.$executeRawUnsafe(statement, f.tenantId)).rejects.toThrow("APPEND_ONLY");
      }
      await expect(runtime.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`)).rejects.toThrow();
    }
  });
});
