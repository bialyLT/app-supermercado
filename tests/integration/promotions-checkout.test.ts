import { afterAll, describe, expect, it } from "vitest";
import { confirmSale, recordReceipt } from "../../src/server/inventory";
import { reverseSale } from "../../src/server/reversal";
import { admin, clock, enabled, fixture } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); });

(enabled ? describe : describe.skip)("promotion checkout integration", () => {
  it("prices a promotion server-side, snapshots the rule, replays idempotently, and reverses the effective amount", async () => {
    const f = await fixture("ADMIN", { unitPrice: "1.00" });
    const category = await admin.productCategory.create({
      data: { tenantId: f.tenantId, code: "beverages", name: "Beverages" },
    });
    await admin.product.update({ where: { id: f.productId }, data: { categoryId: category.id } });
    await admin.promotion.create({
      data: {
        tenantId: f.tenantId,
        categoryId: category.id,
        name: "2x1 Beverages",
        n: 2,
        m: 1,
      },
    });
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "seed", idempotencyKey: "promotion-seed" }, clock);

    const input = { ...f.stock, quantity: "2", unitPrice: "1.00", idempotencyKey: "promotion-sale" };
    const sale = await confirmSale(f.actor, input, clock);
    expect(sale.total).toBe("1.00");

    const line = await admin.saleLine.findFirstOrThrow({ where: { tenantId: f.tenantId, saleId: sale.id } });
    expect(line.unitPrice.toString()).toBe("0.5");
    expect(line.sourceSnapshot).toMatchObject({
      type: "PROMOTION",
      regularUnitPrice: "1.00",
      regularTotal: "2.00",
      discountAmount: "1.00",
      effectiveTotal: "1.00",
      promotion: { name: "2x1 Beverages", n: "2", m: "1" },
    });
    expect(await confirmSale(f.actor, input, clock)).toEqual(sale);

    const reversal = await reverseSale(f.actor, {
      saleId: sale.id,
      type: "ANNULMENT",
      lines: [{ saleLineId: line.id, quantity: "2" }],
      reason: "Promotion reversal",
      idempotencyKey: "promotion-reversal",
    }, clock);
    expect(reversal.total).toBe("1.00");
  });
});
