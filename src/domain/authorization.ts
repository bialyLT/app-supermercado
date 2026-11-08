import type { RoleName } from "./contracts";

const permissions: Record<RoleName, readonly string[]> = {
  CASHIER: ["cash.read"],
  SUPERVISOR: ["cash.read", "cash.override", "cash.history.read", "sales.read"],
  STOCK_MANAGER: ["cash.read", "inventory.write", "inventory.level.read", "inventory.ledger.read"],
  ADMIN: ["cash.read", "cash.override", "cash.history.read", "sales.read", "inventory.write", "inventory.level.read", "inventory.ledger.read", "settings.write"],
};

export function hasPermission(role: RoleName, permission: string): boolean {
  return permissions[role].includes(permission.includes(":") ? permission.replace(":", ".") : permission);
}

export function assertTenantAccess(requestTenantId: string, resourceTenantId: string): void {
  if (requestTenantId !== resourceTenantId) {
    throw new Error("TENANT_ACCESS_DENIED");
  }
}
