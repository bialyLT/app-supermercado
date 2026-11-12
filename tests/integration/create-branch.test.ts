import { afterAll, describe, expect, it } from "vitest";
import { createBranch } from "../../src/server/branches";
import { admin, clock, enabled, fixture } from "./fixtures";

afterAll(() => admin.$disconnect());

(enabled ? describe : describe.skip)("branch creation upgrades the tenant (KAN-17)", () => {
  it("creates a second branch and switches SIMPLE to MULTI atomically", async () => {
    const f = await fixture("ADMIN");
    await admin.tenant.update({ where: { id: f.tenantId }, data: { operationalMode: "SIMPLE" } });

    const result = await createBranch(f.actor, { name: "Sucursal Norte", code: "norte" });

    expect(result.operationalMode).toBe("MULTI");
    const tenant = await admin.tenant.findUniqueOrThrow({ where: { id: f.tenantId } });
    expect(tenant.operationalMode).toBe("MULTI");
    const branch = await admin.branch.findUniqueOrThrow({ where: { id: result.branchId } });
    expect(branch.code).toBe("NORTE");
    expect(branch.name).toBe("Sucursal Norte");
    const audit = await admin.auditLog.findFirst({ where: { tenantId: f.tenantId, action: "branch.created" } });
    expect(audit?.entityId).toBe(result.branchId);
    void clock;
  });

  it("refuses non-admin actors", async () => {
    const f = await fixture("CASHIER");
    await expect(createBranch(f.actor, { name: "Otra", code: "OTRA" })).rejects.toThrow("FORBIDDEN");
  });

  it("rejects empty name or code", async () => {
    const f = await fixture("ADMIN");
    await expect(createBranch(f.actor, { name: "  ", code: "X" })).rejects.toThrow("VALIDATION");
  });
});
