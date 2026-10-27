import { afterAll, describe, expect, it } from "vitest";
import { confirmPaidMultiLineSale, confirmSale, recordReceipt } from "../../src/server/inventory";
import { recordCashMovement } from "../../src/server/cash";
import { closeBranchDocuments } from "../../src/server/numbering";
import { reverseSale } from "../../src/server/reversal";
import { addActor, admin, clock, enabled, fixture } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); });
(enabled ? describe : describe.skip)("document numbering and closure", () => {
  it("numbers concurrent sales gap-free per branch from 1", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "20", reason: "seed", idempotencyKey: "receipt" }, clock);
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      confirmPaidMultiLineSale(f.actor, {
        lines: [{ ...f.stock, quantity: "1", unitPrice: "1.00" }],
        payments: [{ method: "CASH", amount: "1.00" }],
        allowUnverifiedIntake: false,
        idempotencyKey: `concurrent-${index}`,
      }, clock)));
    const numbers = results.map((result) => result.documentNumber).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(numbers).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  }, 60000);

  it("does not consume numbers on rolled-back transactions", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1.00", idempotencyKey: "doomed", allowUnverifiedIntake: false }, clock))
      .rejects.toThrow("INSUFFICIENT_STOCK");
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "receipt" }, clock);
    const first = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1.00", idempotencyKey: "sale-1", allowUnverifiedIntake: false }, clock);
    const second = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1.00", idempotencyKey: "sale-2", allowUnverifiedIntake: false }, clock);
    expect(first.documentNumber).toBe(1);
    expect(second.documentNumber).toBe(2);
  });

  it("backfills legacy documents by creation order on the first new document", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    const older = new Date("2026-10-20T12:00:00Z");
    const newer = new Date("2026-10-21T12:00:00Z");
    const legacyNewer = await admin.sale.create({ data: { tenantId: f.tenantId, locationId: f.locationId,
      total: "4.00", currency: "XTS", registerSessionId: f.registerSessionId, createdAt: newer } });
    const legacyOlder = await admin.sale.create({ data: { tenantId: f.tenantId, locationId: f.locationId,
      total: "2.00", currency: "XTS", registerSessionId: f.registerSessionId, createdAt: older } });
    await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "receipt" }, clock);
    const fresh = await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1.00", idempotencyKey: "sale", allowUnverifiedIntake: false }, clock);
    expect((await admin.sale.findUniqueOrThrow({ where: { id: legacyOlder.id } })).documentNumber).toBe(1);
    expect((await admin.sale.findUniqueOrThrow({ where: { id: legacyNewer.id } })).documentNumber).toBe(2);
    expect(fresh.documentNumber).toBe(3);
  });

  it("numbers annulments and returns on independent per-branch sequences", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.00" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "6", reason: "seed", idempotencyKey: "receipt" }, clock);
    const first = await confirmSale(f.actor, { ...f.stock, quantity: "2", unitPrice: "2.00", idempotencyKey: "sale-1", allowUnverifiedIntake: false }, clock);
    const second = await confirmSale(f.actor, { ...f.stock, quantity: "2", unitPrice: "2.00", idempotencyKey: "sale-2", allowUnverifiedIntake: false }, clock);
    const third = await confirmSale(f.actor, { ...f.stock, quantity: "2", unitPrice: "2.00", idempotencyKey: "sale-3", allowUnverifiedIntake: false }, clock);
    expect([first.documentNumber, second.documentNumber, third.documentNumber]).toEqual([1, 2, 3]);
    const lineOf = async (saleId: string) => (await admin.saleLine.findFirstOrThrow({ where: { saleId } })).id;
    const annulmentOne = await reverseSale(f.actor, { saleId: first.id, type: "ANNULMENT",
      lines: [{ saleLineId: await lineOf(first.id), quantity: "2" }], reason: "void one", idempotencyKey: "reverse-1" }, clock);
    const annulmentTwo = await reverseSale(f.actor, { saleId: second.id, type: "ANNULMENT",
      lines: [{ saleLineId: await lineOf(second.id), quantity: "2" }], reason: "void two", idempotencyKey: "reverse-2" }, clock);
    const ret = await reverseSale(f.actor, { saleId: third.id, type: "RETURN",
      lines: [{ saleLineId: await lineOf(third.id), quantity: "2" }], reason: "take back", idempotencyKey: "reverse-3" }, clock);
    expect(annulmentOne.documentNumber).toBe(1);
    expect(annulmentTwo.documentNumber).toBe(2);
    expect(ret.documentNumber).toBe(1);
  });

  it("rejects closure on sequence gaps before any write", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "3", reason: "seed", idempotencyKey: "receipt" }, clock);
    for (const key of ["sale-1", "sale-2", "sale-3"])
      await confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1.00", idempotencyKey: key, allowUnverifiedIntake: false }, clock);
    const middle = await admin.sale.findFirstOrThrow({ where: { tenantId: f.tenantId, documentNumber: 2 } });
    await admin.sale.update({ where: { id: middle.id }, data: { documentNumber: 99 } });
    await expect(closeBranchDocuments(f.actor, { branchId: f.branchId, currency: "XTS", reason: "close", idempotencyKey: "close" }, clock))
      .rejects.toThrow("SEQUENCE_GAP");
    expect(await admin.documentClosure.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("rejects closure on unreconciled cash before any write", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "5", reason: "seed", idempotencyKey: "receipt" }, clock);
    await confirmPaidMultiLineSale(f.actor, { lines: [{ ...f.stock, quantity: "5", unitPrice: "1.00" }],
      payments: [{ method: "CASH", amount: "5.00" }], allowUnverifiedIntake: false, idempotencyKey: "sale" }, clock);
    await recordCashMovement(f.actor, { registerSessionId: f.registerSessionId!, type: "CASH_OUT",
      amount: "1.00", reason: "Unexplained withdrawal", idempotencyKey: "withdrawal" }, clock);
    await expect(closeBranchDocuments(f.actor, { branchId: f.branchId, currency: "XTS", reason: "close", idempotencyKey: "close" }, clock))
      .rejects.toThrow("UNRECONCILED_CASH");
    expect(await admin.documentClosure.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("closes a reconciled branch, replays idempotently, and conflicts on changed payload", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    await recordReceipt(f.actor, { ...f.stock, quantity: "5", reason: "seed", idempotencyKey: "receipt" }, clock);
    const sale = await confirmPaidMultiLineSale(f.actor, { lines: [{ ...f.stock, quantity: "5", unitPrice: "1.00" }],
      payments: [{ method: "CASH", amount: "5.00" }], allowUnverifiedIntake: false, idempotencyKey: "sale" }, clock);
    expect(sale.documentNumber).toBe(1);
    const input = { branchId: f.branchId, currency: "XTS", reason: "Month-end", idempotencyKey: "close" };
    const closed = await closeBranchDocuments(f.actor, input, clock);
    expect(closed).toMatchObject({ type: "DOCUMENT_CLOSE", total: "5.00", currency: "XTS" });
    await expect(closeBranchDocuments(f.actor, input, clock)).resolves.toEqual(closed);
    await expect(closeBranchDocuments(f.actor, { ...input, reason: "Different reason" }, clock))
      .rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const stored = await admin.documentClosure.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    expect(stored).toMatchObject({ branchId: f.branchId, saleCount: 1, saleMax: 1, reason: "Month-end" });
    for (const field of ["saleTotal", "paymentsTotal", "movementsIn", "movementsOut", "cashTotal", "netTotal"] as const)
      expect(stored[field].toFixed(2)).toBe(field === "movementsIn" || field === "movementsOut" ? "0.00" : "5.00");
  });

  it("denies closure to cashiers and to other tenants", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    const other = await fixture("ADMIN", { unitPrice: "1.00" });
    const cashier = await addActor(f.tenantId, f.branchId, "CASHIER");
    await expect(closeBranchDocuments(cashier, { branchId: f.branchId, currency: "XTS", reason: "close", idempotencyKey: "close" }, clock))
      .rejects.toThrow("FORBIDDEN");
    const foreign = { ...f.actor, tenantId: other.tenantId };
    await expect(closeBranchDocuments(foreign, { branchId: f.branchId, currency: "XTS", reason: "close", idempotencyKey: "foreign" }, clock))
      .rejects.toThrow();
    expect(await admin.documentClosure.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });
});
