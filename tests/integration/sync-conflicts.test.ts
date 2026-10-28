import { afterAll, describe, expect, it } from "vitest";
import { admin, enabled, fixture } from "./fixtures";
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

  it("prevents a duplicate conflict command within the tenant", async () => {
    const f = await fixture("ADMIN");
    await recordSyncConflict(f.actor, { commandId: "same-command", kind: "REVERSAL_CONFLICT", payload: { saleId: "sale" } });
    await expect(recordSyncConflict(f.actor, { commandId: "same-command", kind: "REVERSAL_CONFLICT", payload: { saleId: "other" } })).rejects.toMatchObject({ code: "P2002" });
  });
});
