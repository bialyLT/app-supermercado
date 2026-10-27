import { afterAll, describe, expect, it } from "vitest";
import { confirmPaidMultiLineSale, recordReceipt } from "../../src/server/inventory";
import type { PaidMultiSaleInput } from "../../src/domain/inventory";
import { admin, fixture, clock, enabled, reconcile } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); });
(enabled ? describe : describe.skip)("manual payments", () => {
  it("confirms mixed methods only when their exact sum matches the server total", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "seed-paid" }, clock);
    const input: PaidMultiSaleInput = { allowUnverifiedIntake: false, idempotencyKey: "paid-sale", lines: [{ ...f.stock, quantity: "2" }], payments: [
      { method: "CASH", amount: "2.50" }, { method: "CARD", amount: "2.50" },
    ] };
    const result = await confirmPaidMultiLineSale(f.actor, input, clock);
    expect(result).toMatchObject({ type: "SALE", total: "5.00", currency: "XTS" });
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(2);
    expect(await confirmPaidMultiLineSale(f.actor, input, clock)).toEqual(result);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it.each(["4.99", "5.01"]) ("rejects non-exact payment %s without mutation", async (amount) => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: `seed-${amount}` }, clock);
    await expect(confirmPaidMultiLineSale(f.actor, { idempotencyKey: `bad-${amount}`, lines: [{ ...f.stock, quantity: "2" }], payments: [{ method: "CASH", amount }] as const }, clock)).rejects.toThrow("PAYMENT_TOTAL_MISMATCH");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.idempotencyCommand.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("rejects a changed payload for a replay key", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "seed-conflict" }, clock);
    const base = { idempotencyKey: "paid-conflict", lines: [{ ...f.stock, quantity: "2" }] };
    await confirmPaidMultiLineSale(f.actor, { ...base, payments: [{ method: "CASH" as const, amount: "5" }] }, clock);
    await expect(confirmPaidMultiLineSale(f.actor, { ...base, payments: [{ method: "CARD" as const, amount: "5" }] }, clock)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(1);
  });
});
