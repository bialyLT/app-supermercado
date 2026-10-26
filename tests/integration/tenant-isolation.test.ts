import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleName } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }),
});
const ids: string[] = [];

describeDatabase("PostgreSQL tenant isolation constraints", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Test teardown uses TRUNCATE, which bypasses row-level mutation triggers.
    await prisma.$executeRaw`TRUNCATE TABLE "AuditLog" CASCADE`;
    await prisma.userRole.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.cashRegister.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.branch.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.store.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.role.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("accepts valid same-tenant relationships", async () => {
    const tenant = await prisma.tenant.create({ data: { name: "Tenant A", slug: `tenant-a-${Date.now()}` } });
    ids.push(tenant.id);
    const store = await prisma.store.create({ data: { tenantId: tenant.id, name: "Store A" } });
    const branch = await prisma.branch.create({
      data: { tenantId: tenant.id, storeId: store.id, code: "A", name: "Branch A" },
    });
    const user = await prisma.user.create({
      data: { tenantId: tenant.id, email: `a-${Date.now()}@example.test`, displayName: "User A" },
    });
    const role = await prisma.role.create({ data: { tenantId: tenant.id, name: RoleName.ADMIN } });

    await expect(
      prisma.cashRegister.create({ data: { tenantId: tenant.id, branchId: branch.id, name: "Register A" } }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: role.id } }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: user.id,
          action: "test",
          entityType: "Tenant",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it.each(["branch", "cashRegister", "userRole-user", "userRole-role", "auditLog"])(
    "rejects a cross-tenant %s relationship",
    async (relation) => {
      const tenantA = await prisma.tenant.create({ data: { name: "Tenant A", slug: `a-${crypto.randomUUID()}` } });
      const tenantB = await prisma.tenant.create({ data: { name: "Tenant B", slug: `b-${crypto.randomUUID()}` } });
      ids.push(tenantA.id, tenantB.id);
      const storeB = await prisma.store.create({ data: { tenantId: tenantB.id, name: "Store B" } });
      const branchB = await prisma.branch.create({
        data: { tenantId: tenantB.id, storeId: storeB.id, code: "B", name: "Branch B" },
      });
      const userB = await prisma.user.create({
        data: { tenantId: tenantB.id, email: `b-${crypto.randomUUID()}@example.test`, displayName: "User B" },
      });
      const roleB = await prisma.role.create({ data: { tenantId: tenantB.id, name: RoleName.ADMIN } });
      const userA = await prisma.user.create({
        data: { tenantId: tenantA.id, email: `a-${crypto.randomUUID()}@example.test`, displayName: "User A" },
      });
      const roleA = await prisma.role.create({ data: { tenantId: tenantA.id, name: RoleName.ADMIN } });

      const operation =
        relation === "branch"
          ? prisma.branch.create({ data: { tenantId: tenantA.id, storeId: storeB.id, code: "A", name: "Invalid" } })
          : relation === "cashRegister"
            ? prisma.cashRegister.create({ data: { tenantId: tenantA.id, branchId: branchB.id, name: "Invalid" } })
            : relation === "userRole-user"
            ? prisma.userRole.create({ data: { tenantId: tenantA.id, userId: userB.id, roleId: roleA.id } })
            : relation === "userRole-role"
              ? prisma.userRole.create({ data: { tenantId: tenantA.id, userId: userA.id, roleId: roleB.id } })
              : prisma.auditLog.create({
                  data: { tenantId: tenantA.id, actorUserId: userB.id, action: "invalid", entityType: "Tenant" },
                });

      await expect(operation).rejects.toMatchObject({ code: "P2003" });
    },
  );
});
