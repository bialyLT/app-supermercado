import { afterAll, describe, expect, it } from "vitest";
import { confirmSale, recordReceipt } from "../../src/server/inventory";
import { admin, runtime, clock, fixture, enabled } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); await runtime.$disconnect(); });
(enabled ? describe : describe.skip)("hardening bug reproductions", () => {
  it("rejects a receipt key reused with another quantity", async () => {
    const f = await fixture();
    const input = { ...f.stock, quantity: "1", reason: "fixture", idempotencyKey: "same" };
    await recordReceipt(f.actor, input, clock);
    await expect(recordReceipt(f.actor, { ...input, quantity: "2" }, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("blocks an expired lot in the real sale flow", async () => {
    const f = await fixture();
    const lot = await admin.lot.create({ data: { tenantId: f.tenantId, variantId: f.variantId, lotNumber: "expired", expiresAt: new Date("2000-01-01T00:00:00Z") } });
    await recordReceipt(f.actor, { ...f.stock, lotId: lot.id, quantity: "1", reason: "fixture", idempotencyKey: "receipt" }, clock);
    await expect(confirmSale(f.actor, { ...f.stock, lotId: lot.id, quantity: "1", unitPrice: "1", idempotencyKey: "sale" }, clock)).rejects.toThrow("EXPIRED_LOT");
  });
  it("forces RLS on inventory levels", async () => {
    const tables = await admin.$queryRaw<{ relforcerowsecurity: boolean }[]>`SELECT relforcerowsecurity FROM pg_class WHERE relname = 'InventoryLevel'`;
    expect(tables[0]?.relforcerowsecurity).toBe(true);
  });
  it("uses the contractual pending review status", async () => {
    const labels = await admin.$queryRaw<{ enumlabel: string }[]>`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid WHERE typname = 'ReviewStatus'`;
    expect(labels.map((label) => label.enumlabel)).toContain("PENDING_REVIEW");
  });
});
