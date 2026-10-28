import { afterAll, describe, expect, it } from "vitest";
import { admin, enabled, fixture, clock } from "./fixtures";
import { confirmPaidMultiLineSale } from "../../src/server/inventory";
import { listSyncConflicts, recordSyncConflict, resolveSyncConflict } from "../../src/server/repositories/sync-conflict";

afterAll(async () => { await admin.$disconnect(); });
(enabled ? describe : describe.skip)("offline sync conflicts", () => {
  it("persists a tenant-scoped product duplicate for supervisor resolution", async () => {
    const f = await fixture("ADMIN");
    const conflict = await recordSyncConflict(f.actor, {
      commandId: "offline-product-duplicate",
      kind: "PRODUCT_DUPLICATE",
      payload: { sku: "existing", name: "Offline copy" },
    });
    expect(conflict).toMatchObject({ tenantId: f.tenantId, commandId: "offline-product-duplicate", kind: "PRODUCT_DUPLICATE", status: "OPEN" });
    expect(await admin.syncConflict.count({ where: { tenantId: f.tenantId } })).toBe(1);
    expect((await listSyncConflicts(f.actor)).map((item) => item.id)).toContain(conflict.id);
    const resolved = await resolveSyncConflict(f.actor, conflict.id, "RESOLVED", { mergedInto: "existing" });
    expect(resolved.status).toBe("RESOLVED");
    expect(await listSyncConflicts(f.actor)).toHaveLength(0);
  });

  it("records A2 stock discrepancy when an offline replay uses unverified intake", async () => {
    const f = await fixture("ADMIN", { unitPrice: "2.50" });
    const result = await confirmPaidMultiLineSale(f.actor, { allowUnverifiedIntake: true, idempotencyKey: "offline-sale", lines: [{ ...f.stock, quantity: "2" }], payments: [{ method: "CASH", amount: "5" }] }, clock);
    expect(result.type).toBe("SALE");
    expect(await admin.syncConflict.findFirst({ where: { tenantId: f.tenantId, kind: "STOCK_DISCREPANCY" } })).toMatchObject({ status: "OPEN" });
  });

  it("prevents a duplicate conflict command within the tenant", async () => {
    const f = await fixture("ADMIN");
    await recordSyncConflict(f.actor, { commandId: "same-command", kind: "REVERSAL_CONFLICT", payload: { saleId: "sale" } });
    await expect(recordSyncConflict(f.actor, { commandId: "same-command", kind: "REVERSAL_CONFLICT", payload: { saleId: "other" } })).rejects.toMatchObject({ code: "P2002" });
  });
});
