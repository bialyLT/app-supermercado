import { afterAll, describe, expect, it } from "vitest";
import { createIdentityUser, findIdentity } from "../../src/server/repositories/identity";
import { appendAuditLog } from "../../src/server/audit";
import { withTenant } from "../../src/server/repositories/tenant-context";
import { admin, runtime, enabled, fixture } from "./fixtures";

afterAll(async () => { await admin.$disconnect(); await runtime.$disconnect(); });
(enabled ? describe : describe.skip)("identity repository integration", () => {
  it("creates and resolves identities with a separate authentication role", async () => {
    const f = await fixture();
    for (const branchId of [f.branchId, undefined]) {
      const email = `${crypto.randomUUID()}@example.test`;
      const user = await createIdentityUser(f.actor, { email, displayName: "Gate", role: "CASHIER", branchId }, "synthetic-hash-not-a-password");
      const identity = await findIdentity(user.id);
      const account = await admin.account.findFirstOrThrow({ where: { userId: user.id, providerId: "credential" } });
      expect(account.accountId).toBe(user.id);
      expect(identity?.tenantId).toBe(f.tenantId);
      expect(identity?.roles).toEqual(["CASHIER"]);
      expect(identity?.branchIds).toHaveLength(branchId ? 1 : 0);
      await appendAuditLog({ tenantId: f.tenantId, actorUserId: f.actor.userId, action: "gate.created", entityType: "User", entityId: user.id });
    }
    expect(await findIdentity(crypto.randomUUID())).toBeNull();
  });

  it("refuses the migration/superuser connection as an inventory runtime", async () => {
    const f = await fixture();
    await expect(withTenant(admin, f.actor, async () => true)).rejects.toThrow("UNSAFE_DATABASE_ROLE");
  });

  it("does not grant runtime access to migration history", async () => {
    await expect(runtime.$queryRaw`SELECT migration_name FROM "_prisma_migrations"`).rejects.toThrow("permission denied");
  });
});
