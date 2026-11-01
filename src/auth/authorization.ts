import type { RoleName } from "../domain/contracts";
export { getHighestRole } from "./roles";

const permissions: Record<RoleName, readonly string[]> = {
  CASHIER: ["cash.read"],
  SUPERVISOR: ["cash.read", "cash.override", "cash.history.read", "sales.read", "inventory.unverified_intake.review"],
  STOCK_MANAGER: ["cash.read", "inventory.write", "inventory.level.read", "inventory.ledger.read"],
  ADMIN: ["cash.read", "cash.override", "cash.history.read", "sales.read", "inventory.write", "inventory.level.read", "inventory.ledger.read", "settings.write"],
};

export function normalizePermission(permission: string): string {
  return permission.includes(":") ? permission.replace(":", ".") : permission;
}

export function roleHasPermission(role: RoleName, permission: string): boolean {
  return permissions[role].includes(normalizePermission(permission));
}

export async function requirePermission(permission: string, branchId?: string) {
  const { getServerIdentity } = await import("./session");
  const identity = await getServerIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");
  if (branchId && !identity.branchIds.includes(branchId)) throw new Error("NOT_FOUND");
  const allowed = identity.roles.some((role) => roleHasPermission(role, permission));
  if (!allowed) {
    throw new Error("FORBIDDEN");
  }
  return identity;
}
