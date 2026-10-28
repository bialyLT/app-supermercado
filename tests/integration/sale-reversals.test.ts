import { afterAll, describe, expect, it } from "vitest";
import { confirmSale, recordReceipt } from "../../src/server/inventory";
import { reverseSale } from "../../src/server/reversal";
import { addActor, admin, clock, enabled, fixture, reconcile } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); });
(enabled ? describe : describe.skip)("sale reversals", () => {
  it("denies cashier and leaves the original sale untouched", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "receipt" }, clock);
    const sale = await confirmSale(f.actor, { ...f.stock, quantity: "2", unitPrice: "2.50", idempotencyKey: "sale", allowUnverifiedIntake: false }, clock);
    const cashier = await addActor(f.tenantId, f.branchId, "CASHIER");
    await expect(reverseSale(cashier, { saleId: sale.id, type: "ANNULMENT", lines: [{ saleLineId: (await admin.saleLine.findFirstOrThrow({ where: { saleId: sale.id } })).id, quantity: "2" }], reason: "void", idempotencyKey: "reverse" }, clock)).rejects.toThrow("FORBIDDEN");
    expect(await admin.sale.count({ where: { id: sale.id } })).toBe(1);
    expect(await admin.saleReversal.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("annuls a sale append-only, restores stock, and creates one auditable cash out", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "receipt" }, clock);
    const sale = await confirmSale(f.actor, { ...f.stock, quantity: "2", unitPrice: "2.50", idempotencyKey: "sale", allowUnverifiedIntake: false }, clock);
    const line = await admin.saleLine.findFirstOrThrow({ where: { saleId: sale.id } });
    const original = await admin.sale.findUniqueOrThrow({ where: { id: sale.id } });
    const result = await reverseSale(f.actor, { saleId: sale.id, type: "ANNULMENT", lines: [{ saleLineId: line.id, quantity: "2" }], reason: "Customer cancellation", idempotencyKey: "reverse" }, clock);
    expect(result).toMatchObject({ type: "ANNULMENT", total: "5.00", currency: "XTS" });
    expect(await reverseSale(f.actor, { saleId: sale.id, type: "ANNULMENT", lines: [{ saleLineId: line.id, quantity: "2" }], reason: "Customer cancellation", idempotencyKey: "reverse" }, clock)).toEqual(result);
    expect(await reverseSale(f.actor, { saleId: sale.id, type: "ANNULMENT", lines: [{ saleLineId: line.id, quantity: "2" }], reason: "Duplicate from offline POS", idempotencyKey: "reverse-duplicate" }, clock)).toEqual(result);
    await expect(reverseSale(f.actor, { saleId: sale.id, type: "RETURN", lines: [{ saleLineId: line.id, quantity: "2" }], reason: "Different effect", idempotencyKey: "reverse-2" }, clock)).rejects.toThrow("REVERSAL_QUANTITY_EXCEEDED");
    expect(await admin.sale.findUniqueOrThrow({ where: { id: sale.id } })).toMatchObject({ total: original.total });
    expect(await admin.inventoryMovement.count({ where: { tenantId: f.tenantId, type: "RETURN" } })).toBe(1);
    expect(await admin.cashMovement.count({ where: { tenantId: f.tenantId, type: "CASH_OUT", referenceId: result.id } })).toBe(1);
    expect(await admin.auditLog.count({ where: { tenantId: f.tenantId, action: "sale.reversed" } })).toBe(1);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("rejects partial quantities explicitly and rejects another tenant's sale", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    const other = await fixture("ADMIN", { unitPrice: "2.50" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "receipt" }, clock);
    const sale = await confirmSale(f.actor, { ...f.stock, quantity: "2", unitPrice: "2.50", idempotencyKey: "sale", allowUnverifiedIntake: false }, clock);
    const line = await admin.saleLine.findFirstOrThrow({ where: { saleId: sale.id } });
    await expect(reverseSale(f.actor, { saleId: sale.id, type: "RETURN", lines: [{ saleLineId: line.id, quantity: "1" }], reason: "partial", idempotencyKey: "partial" }, clock)).rejects.toThrow("PARTIAL_RETURN_UNSUPPORTED");
    const foreign = { ...f.actor, tenantId: other.tenantId };
    await expect(reverseSale(foreign, { saleId: sale.id, type: "ANNULMENT", lines: [{ saleLineId: line.id, quantity: "2" }], reason: "foreign", idempotencyKey: "foreign" }, clock)).rejects.toThrow();
  });
});
