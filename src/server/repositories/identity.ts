import { prismaAdapter } from "@better-auth/prisma-adapter";
import type { RoleName } from "../../domain/contracts";
import { prisma, authPrisma } from "./client";

export function authDatabaseAdapter() { return prismaAdapter(authPrisma, { provider: "postgresql", transaction: true }); }
export async function findIdentity(userId: string) {
  const user = await authPrisma.user.findFirst({ where: { id: userId, active: true }, include: { roles: { include: { role: true } }, branches: true } });
  if (!user) return null;
  return { userId: user.id, tenantId: user.tenantId, roles: user.roles.map(({ role }) => role.name), branchIds: user.branches.map(({ branchId }) => branchId) };
}

export async function createIdentityUser(identity: { tenantId: string }, body: {
  email: string; displayName: string; role: RoleName; branchId?: string;
}, password: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${identity.tenantId}, true)`;
    const created = await tx.user.create({ data: { tenantId: identity.tenantId, email: body.email.toLowerCase(), displayName: body.displayName, name: body.displayName, active: true } });
    const role = await tx.role.upsert({ where: { tenantId_name: { tenantId: identity.tenantId, name: body.role } }, update: {}, create: { tenantId: identity.tenantId, name: body.role } });
    await tx.userRole.create({ data: { tenantId: identity.tenantId, userId: created.id, roleId: role.id } });
    if (body.branchId) await tx.userBranch.create({ data: { tenantId: identity.tenantId, userId: created.id, branchId: body.branchId } });
    await tx.account.create({ data: { id: crypto.randomUUID(), accountId: created.id, providerId: "credential", userId: created.id, password } });
    return created;
  });
}
