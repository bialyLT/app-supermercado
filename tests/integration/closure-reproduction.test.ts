import { afterAll, describe, expect, it } from "vitest";
import { confirmSale, recordReceipt } from "../../src/server/inventory";
import { admin, fixture, clock, enabled } from "./fixtures";

afterAll(() => admin.$disconnect());
(enabled ? describe : describe.skip)("closure missing invariants", () => {
  it("does not confirm a sale without an open cash register session", async () => {
    const f = await fixture("ADMIN", { cashSession: false });
    await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "seed" }, clock);
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "sale" }, clock)).rejects.toThrow("REGISTER_SESSION_REQUIRED");
  });
  it("does not trust a caller's price over the effective server price", async () => {
    const f = await fixture();
    await admin.price.update({ where: { id: f.priceId }, data: { amount: "100" } });
    await recordReceipt(f.actor, { ...f.stock, quantity: "1", reason: "seed", idempotencyKey: "seed" }, clock);
    await expect(confirmSale(f.actor, { ...f.stock, quantity: "1", unitPrice: "1", idempotencyKey: "sale" }, clock)).rejects.toThrow("PRICE_MISMATCH");
  });
});
