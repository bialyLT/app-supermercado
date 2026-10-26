import type { RoleName } from "./contracts";

const permissions: Record<RoleName, readonly string[]> = {
  CASHIER: ["cash:read"],
  SUPERVISOR: ["cash:read", "cash:override"],
  STOCK_MANAGER: ["cash:read", "inventory:write"],
  ADMIN: ["cash:read", "cash:override", "inventory:write", "settings:write"],
};

export function hasPermission(role: RoleName, permission: string): boolean {
  return permissions[role].includes(permission);
}

export function assertTenantAccess(requestTenantId: string, resourceTenantId: string): void {
  if (requestTenantId !== resourceTenantId) {
    throw new Error("TENANT_ACCESS_DENIED");
  }
}
