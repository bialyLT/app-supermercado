import type { Actor } from "../../domain/actor";
import { prisma } from "./client";
import { withTenant } from "./tenant-context";

export type CreateBranchInput = { name: string; code: string };

/**
 * Creating a branch is the explicit upgrade path out of SIMPLE: the tenant can
 * no longer be "one branch with one register", so the mode flips in the same
 * transaction that creates the branch. Nothing else is rewritten.
 */
export async function createBranch(actor: Actor, input: CreateBranchInput) {
  if (actor.role !== "ADMIN") throw new Error("FORBIDDEN");
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (!name || !code) throw new Error("VALIDATION");

  return withTenant(prisma, actor, async (tx) => {
    const store = await tx.store.findFirstOrThrow({
      where: { tenantId: actor.tenantId },
      select: { id: true },
    });
    const branch = await tx.branch.create({
      data: { tenantId: actor.tenantId, storeId: store.id, code, name },
    });
    const previous = await tx.tenant.findUniqueOrThrow({
      where: { id: actor.tenantId },
      select: { operationalMode: true },
    });
    const tenant = await tx.tenant.update({
      where: { id: actor.tenantId },
      data: { operationalMode: "MULTI" },
      select: { operationalMode: true },
    });
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "branch.created",
        entityType: "Branch",
        entityId: branch.id,
        previousValue: { operationalMode: previous.operationalMode },
        newValue: { code, name, operationalMode: tenant.operationalMode },
      },
    });
    return { branchId: branch.id, operationalMode: tenant.operationalMode };
  });
}
