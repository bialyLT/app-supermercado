import { afterAll, describe, expect, it } from "vitest";
import {
  getUnverifiedIntake,
  listInventoryAlerts,
  listInventoryReceipts,
  listUnverifiedIntakes,
  recordReceipt,
  reviewUnverifiedIntake,
} from "../../src/server/inventory";
import { configureInventoryPolicy } from "../../src/server/cash";
import { admin, fixture, addActor, clock, now, enabled } from "./fixtures";

afterAll(() => admin.$disconnect());
(enabled ? describe : describe.skip)("pending intake alerts", () => {
  it("alerts automatically only after the threshold, excludes resolved cases, and exposes cashier volumes", async () => {
    const f = await fixture();
    await recordReceipt(f.actor, { ...f.stock, quantity: "2", reason: "Receipt read fixture", idempotencyKey: "receipt-read" }, clock);
    const boundary = new Date(now.getTime() - 7 * 86400000);
    const reviews: { id: string }[] = [];
    for (const createdAt of [boundary, new Date(boundary.getTime() - 1), new Date(boundary.getTime() - 2)]) {
      const review = await admin.unverifiedIntakeReview.create({ data: { tenantId: f.tenantId, locationId: f.locationId,
        variantId: f.variantId, quantity: "1", reason: "Historical intake fixture", createdBy: f.actor.userId,
        intakeValue: "1", currency: "XTS", createdAt } });
      reviews.push({ id: review.id });
    }
    const reviewer = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
    const receipts = await listInventoryReceipts(reviewer, clock);
    expect(receipts.receipts).toMatchObject([{ locationId: f.locationId, variantId: f.variantId, quantity: "2", reason: "Receipt read fixture" }]);
    await reviewUnverifiedIntake(reviewer, { reviewId: reviews[2].id, decision: "CONFIRMED", acknowledgeUnknownCost: true, reason: "Resolved", idempotencyKey: "review" }, clock);
    const result = await listInventoryAlerts(reviewer, clock);
    expect(result.alerts.map((alert) => alert.reviewId)).toEqual([reviews[1].id]);
    expect(result.intakesByCashier).toEqual([{ cashierId: f.actor.userId, currency: "XTS", count: 3, quantity: "3", value: "3" }]);
  });

  it("supports configured thresholds, legacy unknown values and branch/tenant isolation", async () => {
    const f = await fixture();
    const reviewer = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
    const pending = await admin.unverifiedIntakeReview.create({ data: { tenantId: f.tenantId, ...f.stock, quantity: "1", reason: "Legacy fixture",
      createdBy: f.actor.userId, createdAt: new Date(now.getTime() - 4 * 86400000) } });
    const intakes = await listUnverifiedIntakes(reviewer, clock);
    expect(intakes.intakes).toContainEqual(expect.objectContaining({ id: pending.id, status: "PENDING_REVIEW", intakeValue: null, correctionQuantity: null, reviewedAt: null }));
    expect((await getUnverifiedIntake(reviewer, pending.id, clock)).intake).toMatchObject({ id: pending.id, status: "PENDING_REVIEW", intakeValue: null });
    await expect(getUnverifiedIntake(reviewer, crypto.randomUUID(), clock)).rejects.toThrow("NOT_FOUND");
    expect((await listInventoryAlerts(reviewer, clock)).alerts).toHaveLength(0);
    await configureInventoryPolicy(f.actor, { mode: "ALLOW_WITH_CAPS", currency: "XTS", maxSessionValue: "100", reviewAfterDays: 3 }, clock);
    const foreign = await fixture();
    await admin.unverifiedIntakeReview.create({ data: { tenantId: foreign.tenantId, ...foreign.stock, quantity: "1", reason: "Foreign", createdAt: new Date("2020-01-01") } });
    const store = await admin.store.findFirstOrThrow({ where: { tenantId: f.tenantId } });
    const branch = await admin.branch.create({ data: { tenantId: f.tenantId, storeId: store.id, code: "other", name: "Other" } });
    const location = await admin.location.create({ data: { tenantId: f.tenantId, branchId: branch.id, code: "other", name: "Other" } });
    await admin.unverifiedIntakeReview.create({ data: { tenantId: f.tenantId, locationId: location.id, variantId: f.variantId, quantity: "1", reason: "Other branch", createdAt: new Date("2020-01-01") } });
    const result = await listInventoryAlerts({ ...reviewer, branchIds: [f.branchId, branch.id] }, clock);
    expect(result.alerts.map((alert) => alert.reviewId)).toEqual([pending.id]);
    expect(result.alerts[0].registerSessionId).toBeNull();
    expect(result.intakesByCashier[0].value).toBeNull();
    const cashier = await addActor(f.tenantId, f.branchId, "CASHIER");
    await expect(listInventoryAlerts(cashier, clock)).rejects.toThrow("FORBIDDEN");
  });
});
