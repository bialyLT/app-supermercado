import { afterAll, describe, expect, it } from "vitest";
import { promotionConfigSchema } from "../../src/domain/promotions";
import { createPromotion, deactivatePromotion, listPromotions, updatePromotion } from "../../src/server/repositories/promotions";
import { admin, enabled, fixture } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); });

(enabled ? describe : describe.skip)("promotion administration repository", () => {
  it("creates, lists, updates, and deactivates tenant-scoped promotions", async () => {
    const f = await fixture("ADMIN");
    const category = await admin.productCategory.create({ data: { tenantId: f.tenantId, code: "admin-category", name: "Admin category" } });
    const input = { categoryId: category.id, name: "2x1 Admin", n: "2", m: "1", active: true };

    const created = await createPromotion(f.actor, input);
    expect(created).toMatchObject({ tenantId: f.tenantId, categoryId: category.id, n: "2", m: "1", active: true });
    expect((await listPromotions(f.actor)).map((promotion) => promotion.id)).toContain(created.id);

    const updated = await updatePromotion(f.actor, created.id, { ...input, name: "3x2 Admin", n: "3", m: "2", branchId: f.branchId });
    expect(updated).toMatchObject({ name: "3x2 Admin", n: "3", m: "2", branchId: f.branchId });

    const deactivated = await deactivatePromotion(f.actor, created.id);
    expect(deactivated.active).toBe(false);
  });

  it("rejects invalid rules and foreign scopes without partial writes", async () => {
    const f = await fixture("ADMIN");
    const other = await fixture("ADMIN");
    const category = await admin.productCategory.create({ data: { tenantId: f.tenantId, code: "invalid-category", name: "Invalid category" } });
    expect(() => promotionConfigSchema.parse({ categoryId: category.id, name: "Invalid", n: "2", m: "2" })).toThrow("N_MUST_BE_GREATER_THAN_M");
    await expect(createPromotion(f.actor, { categoryId: other.productId, name: "Foreign", n: "2", m: "1", active: true })).rejects.toThrow("NOT_FOUND");
    await expect(createPromotion(f.actor, { categoryId: category.id, branchId: other.branchId, name: "Foreign branch", n: "2", m: "1", active: true })).rejects.toThrow("NOT_FOUND");
    expect(await admin.promotion.count({ where: { tenantId: f.tenantId } })).toBe(0);
  });

  it("does not expose another tenant's promotions", async () => {
    const f = await fixture("ADMIN");
    const other = await fixture("ADMIN");
    const category = await admin.productCategory.create({ data: { tenantId: other.tenantId, code: "other-category", name: "Other category" } });
    await createPromotion(other.actor, { categoryId: category.id, name: "Other", n: "2", m: "1", active: true });
    expect((await listPromotions(f.actor)).every((promotion) => promotion.tenantId === f.tenantId)).toBe(true);
  });
});
