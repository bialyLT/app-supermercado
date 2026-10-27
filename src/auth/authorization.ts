import type { RoleName } from "../domain/contracts";

const permissions: Record<RoleName, readonly string[]> = {
  CASHIER: ["cash:read"],
  SUPERVISOR: ["cash:read", "cash:override"],
  STOCK_MANAGER: ["cash:read", "inventory:write"],
  ADMIN: ["cash:read", "cash:override", "inventory:write", "settings:write"],
};

export function roleHasPermission(role: RoleName, permission: string): boolean {
  return permissions[role].includes(permission);
}

export async function requirePermission(permission: string, branchId?: string) {
  const { getServerIdentity } = await import("./session");
  const identity = await getServerIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");
  if (branchId && !identity.branchIds.includes(branchId)) throw new Error("NOT_FOUND");
  const allowed =
    identity.roles.some((role) => roleHasPermission(role, permission));
  if (!allowed) {
    throw new Error("FORBIDDEN");
  }
  return identity;
}
