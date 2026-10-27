import { afterAll, describe, expect, it } from "vitest";
import { confirmMultiLineSale, confirmSale, recordReceipt } from "../../src/server/inventory";
import { admin, fixture, clock, enabled, reconcile } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); });
(enabled ? describe : describe.skip)("multiline sales", () => {
  it("prices every line on the server, rounds each line, and replays idempotently", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    await admin.productVariant.update({ where: { id: f.variantId }, data: { quantityPrecision: 3 } });
    const second = await admin.productVariant.create({ data: { tenantId: f.tenantId, productId: f.productId, unitId: f.unitId, sku: "second", name: "Second" } });
    await admin.productVariant.update({ where: { id: second.id }, data: { quantityPrecision: 3 } });
    await admin.price.create({ data: { tenantId: f.tenantId, variantId: second.id, currency: "XTS", amount: "2.00", validFrom: new Date("2020-01-01T00:00:00Z") } });
    await recordReceipt(f.actor, { ...f.stock, quantity: "1.005", reason: "seed", idempotencyKey: "seed-a" }, clock);
    await recordReceipt(f.actor, { locationId: f.locationId, variantId: second.id, quantity: "1.005", reason: "seed", idempotencyKey: "seed-b" }, clock);
    const input = { idempotencyKey: "multi-sale", lines: [
      { locationId: f.locationId, variantId: f.variantId, quantity: "1.005", unitPrice: "999.99" },
      { locationId: f.locationId, variantId: second.id, quantity: "1.005", unitPrice: "888.88" },
    ] };
    const first = await confirmMultiLineSale(f.actor, input, clock);
    expect(first.total).toBe("3.02");
    expect(await confirmMultiLineSale(f.actor, input, clock)).toEqual(first);
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect(await admin.saleLine.count({ where: { tenantId: f.tenantId } })).toBe(2);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("rejects duplicate lines before any stock or command mutation", async () => {
    const f = await fixture();
    const input = { idempotencyKey: "duplicate-lines", lines: [
      { locationId: f.locationId, variantId: f.variantId, quantity: "1" },
      { locationId: f.locationId, variantId: f.variantId, quantity: "1" },
    ] };
    await expect(confirmMultiLineSale(f.actor, input, clock)).rejects.toThrow();
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.idempotencyCommand.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("keeps the single-line result contract", async () => {
    const f = await fixture();
    await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "seed" }, clock);
    const result = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "single" }, clock);
    expect(result).toMatchObject({ type: "SALE", total: "1.00", currency: "XTS" });
    expect(await admin.saleLine.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });
});
