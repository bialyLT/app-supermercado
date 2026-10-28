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

  it("rejects underpay without mutation", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "seed-under" }, clock);
    await expect(confirmPaidMultiLineSale(f.actor, { idempotencyKey: "bad-under", lines: [{ ...f.stock, quantity: "2" }], payments: [{ method: "CASH", amount: "4.99" }] as const }, clock)).rejects.toThrow("PAYMENT_TOTAL_MISMATCH");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.idempotencyCommand.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("rejects non-CASH overpay without mutation", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "seed-card-over" }, clock);
    await expect(confirmPaidMultiLineSale(f.actor, { idempotencyKey: "bad-card-over", lines: [{ ...f.stock, quantity: "2" }], payments: [{ method: "CARD", amount: "6.00" }] as const }, clock)).rejects.toThrow("PAYMENT_TOTAL_MISMATCH");
    expect(await admin.sale.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(0);
    expect(await reconcile(f.tenantId)).toHaveLength(0);
  });

  it("accepts CASH overpay and records server-computed change as CASH_OUT", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "seed-change" }, clock);
    const result = await confirmPaidMultiLineSale(f.actor, { idempotencyKey: "paid-change", lines: [{ ...f.stock, quantity: "2" }], payments: [{ method: "CASH", amount: "6.00" }] as const }, clock);
    expect(result).toMatchObject({ type: "SALE", total: "5.00", currency: "XTS", change: "1.00" });
    expect(await admin.payment.count({ where: { tenantId: f.tenantId } })).toBe(1);
    const movements = await admin.cashMovement.findMany({ where: { tenantId: f.tenantId, type: "CASH_OUT" } });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.amount.toFixed(2)).toBe("1.00");
    expect(movements[0]).toMatchObject({ reason: "CHANGE", referenceId: result.id });
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
