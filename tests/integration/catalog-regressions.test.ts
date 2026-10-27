import { afterAll, describe, expect, it } from "vitest";
import { createCatalogItem, getCurrentPrice } from "../../src/server/catalog";
import { recordReceipt } from "../../src/server/inventory";
import { admin, enabled, fixture, clock } from "./fixtures";

afterAll(() => admin.$disconnect());
(enabled ? describe : describe.skip)("catalog adversarial audit regressions", () => {
  it("does not expose branch-exclusive prices when branchId is omitted", async () => {
    const f = await fixture();
    await admin.price.delete({ where: { id: f.priceId } });
    const store = await admin.store.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    const otherBranch = await admin.branch.create({ data: { tenantId: f.tenantId, storeId: store.id, code: "other", name: "Other" } });
    await admin.price.create({ data: { tenantId: f.tenantId, variantId: f.variantId, branchId: otherBranch.id, amount: "120", validFrom: new Date("2020-01-01T00:00:00Z") } });
    expect(await getCurrentPrice(f.actor, { variantId: f.variantId })).toBeNull();
  });

  it("prefers an authorized branch price over a global fallback", async () => {
    const f = await fixture();
    await admin.price.delete({ where: { id: f.priceId } });
    for (const [branchId, amount] of [[null, "100"], [f.branchId, "120"]] as const) {
      await admin.price.create({ data: { tenantId: f.tenantId, variantId: f.variantId, branchId, amount, validFrom: new Date("2020-01-01T00:00:00Z") } });
    }
    expect(await getCurrentPrice(f.actor, { variantId: f.variantId, branchId: f.branchId })).toBe("120");
  });

  it("creates new weighed variants with fractional precision", async () => {
    const f = await fixture();
    const product = await createCatalogItem(f.actor, { sku: "weighed", name: "Weighed", kind: "WEIGHT", unitCode: "kg", unitName: "Kilogram" });
    const receipt = await recordReceipt(f.actor, { locationId: f.locationId, variantId: product.variants[0].id, quantity: "0.125", reason: "weighed", idempotencyKey: "weighed" }, clock);
    expect(receipt.type).toBe("RECEIPT");
  });
});
