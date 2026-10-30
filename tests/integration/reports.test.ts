import { afterAll, describe, expect, it } from "vitest";
import { createDirectPurchaseReceipt, createSupplier } from "../../src/server/purchases";
import { confirmPaidMultiLineSale, recordReceipt } from "../../src/server/inventory";
import { operationsReport, operationsReportCsv } from "../../src/server/repositories/reports";
import { createTransfer } from "../../src/server/transfers";
import { admin, clock, enabled, fixture, addActor } from "./fixtures";

const from = "2026-10-01T00:00:00.000Z";
const to = "2026-11-01T00:00:00.000Z";

afterAll(async () => { await admin.$disconnect(); });

(enabled ? describe : describe.skip)("operations reports", () => {
  it("aggregates sales, purchases, transfers, stock and exports CSV with tenant scope", async () => {
    const f = await fixture("ADMIN");
    const destinationBranch = await admin.branch.create({ data: { tenantId: f.tenantId, storeId: f.storeId, code: `report-${crypto.randomUUID()}`, name: "Report destination" } });
    const destinationLocation = await admin.location.create({ data: { tenantId: f.tenantId, branchId: destinationBranch.id, code: `report-${crypto.randomUUID()}`, name: "Report destination location" } });
    const destinationActor = await addActor(f.tenantId, destinationBranch.id, "ADMIN");
    const actor = { ...destinationActor, branchIds: [f.branchId, destinationBranch.id] };

    await recordReceipt(f.actor, { ...f.stock, quantity: "10", reason: "report seed", idempotencyKey: `report-stock-${f.tenantId}` }, clock);
    const supplier = await createSupplier(f.actor, { code: `REPORT-${crypto.randomUUID()}`, name: "Report supplier" });
    await createDirectPurchaseReceipt(f.actor, {
      supplierId: supplier.id, branchId: f.branchId, locationId: f.locationId, currency: "XTS",
      idempotencyKey: `report-purchase-${f.tenantId}`, subtotal: "6.00", total: "6.00",
      lines: [{ variantId: f.variantId, quantity: "3", unitCost: "2.00" }],
    }, clock);
    await confirmPaidMultiLineSale(f.actor, {
      lines: [{ ...f.stock, quantity: "2", unitPrice: "1" }],
      payments: [{ method: "CASH", amount: "2" }],
      idempotencyKey: `report-sale-${f.tenantId}`,
    }, clock);
    await createTransfer(actor, {
      originBranchId: f.branchId, destinationBranchId: destinationBranch.id,
      originLocationId: f.locationId, destinationLocationId: destinationLocation.id,
      lines: [{ variantId: f.variantId, quantity: "4" }], idempotencyKey: `report-transfer-${f.tenantId}`,
    }, clock);

    const report = await operationsReport(f.actor, { from, to, format: "json" });
    expect(report.sales.count).toBe(1);
    expect(report.purchases.count).toBe(1);
    expect(report.transfers.count).toBe(1);
    expect(report.sales.total).toBe("2.00");
    expect(report.purchases.total).toBe("6.00");
    expect(report.branches).toHaveLength(2);

    const csv = operationsReportCsv(report);
    expect(csv).toContain("sales,total,2.00,XTS");
    expect(csv).toContain("purchases,total,6.00,XTS");
  });

  it("limits non-admin reports to assigned branches", async () => {
    const f = await fixture("ADMIN");
    const otherBranch = await admin.branch.create({ data: { tenantId: f.tenantId, storeId: f.storeId, code: `report-scope-${crypto.randomUUID()}`, name: "Other branch" } });
    const stockManager = await addActor(f.tenantId, f.branchId, "STOCK_MANAGER");
    const report = await operationsReport(stockManager, { from, to, format: "json" });
    expect(report.branches.every((branch) => branch.branchId === f.branchId)).toBe(true);
    await expect(operationsReport(stockManager, { from, to, branchId: otherBranch.id, format: "json" })).rejects.toThrow("FORBIDDEN");
  });
});
