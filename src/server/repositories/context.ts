import type { Actor } from "../../domain/actor";
import { prisma } from "./client";
import { withTenant } from "./tenant-context";

export type OperationalLocation = {
  id: string;
  code: string;
  name: string;
  type: string;
  branchId: string;
  active: boolean;
};

export type OperationalBranch = {
  id: string;
  code: string;
  name: string;
  locations: OperationalLocation[];
};

export type OperationalContext = {
  tenantId: string;
  branches: OperationalBranch[];
  locations: OperationalLocation[];
};

export class ContextError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ContextError";
  }
}

export function contextHttpStatus(error: ContextError): number {
  switch (error.code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    default:
      return 400;
  }
}

export function verifyContextPermission(actor: Actor): void {
  const allowed =
    actor.role === "ADMIN" ||
    actor.role === "STOCK_MANAGER" ||
    actor.permissions.includes("inventory.write") ||
    actor.permissions.includes("inventory.receive") ||
    actor.permissions.includes("inventory.transfer");
  if (!allowed) {
    throw new ContextError("FORBIDDEN", "Insufficient permissions for operational context");
  }
}

export async function getOperationalContext(actor: Actor): Promise<OperationalContext> {
  verifyContextPermission(actor);

  return withTenant(prisma, actor, async (tx) => {
    // ADMIN with no explicit branch assignments has tenant-wide branch access.
    // Otherwise, actor is restricted to assigned branches.
    const branchScope =
      actor.role === "ADMIN" && actor.branchIds.length === 0
        ? undefined
        : { in: [...actor.branchIds] };

    const branches = await tx.branch.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(branchScope ? { id: branchScope } : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    const accessibleBranchIds = branches.map((b) => b.id);
    if (accessibleBranchIds.length === 0) {
      return {
        tenantId: actor.tenantId,
        branches: [],
        locations: [],
      };
    }

    const locations = await tx.location.findMany({
      where: {
        tenantId: actor.tenantId,
        active: true,
        branchId: { in: accessibleBranchIds },
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        branchId: true,
        active: true,
      },
      orderBy: { name: "asc" },
    });

    const locationsByBranch = new Map<string, OperationalLocation[]>();
    const mappedLocations: OperationalLocation[] = [];

    for (const loc of locations) {
      if (!loc.branchId) continue;
      const operationalLocation: OperationalLocation = {
        id: loc.id,
        code: loc.code,
        name: loc.name,
        type: loc.type,
        branchId: loc.branchId,
        active: loc.active,
      };
      mappedLocations.push(operationalLocation);
      const currentList = locationsByBranch.get(loc.branchId) ?? [];
      currentList.push(operationalLocation);
      locationsByBranch.set(loc.branchId, currentList);
    }

    const branchesWithLocations: OperationalBranch[] = branches.map((branch) => ({
      id: branch.id,
      code: branch.code,
      name: branch.name,
      locations: locationsByBranch.get(branch.id) ?? [],
    }));

    return {
      tenantId: actor.tenantId,
      branches: branchesWithLocations,
      locations: mappedLocations,
    };
  });
}
