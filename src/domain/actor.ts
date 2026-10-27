import type { RoleName } from "./contracts";

export type Permission =
  | "inventory.write"
  | "inventory.receive"
  | "inventory.sell"
  | "inventory.reserve"
  | "inventory.catalog.write"
  | "inventory.catalog.read"
  | "inventory.policy.manage"
  | "cash.session.open"
  | "cash.session.close"
  | "cash.session.close.other"
  | "identity.supervisor_pin.manage"
  | "inventory.sale.approve"
  | "inventory.unverified_intake.create"
  | "inventory.unverified_intake.review"
  | "inventory.expired.override"
  | "fiscal.profile.manage"
  | "fiscal.profile.read";

export type Actor = Readonly<{
  tenantId: string;
  userId: string;
  role: RoleName;
  branchIds: readonly string[];
  permissions: readonly Permission[];
  sessionId?: string;
}>;

export function requirePermission(actor: Actor, permission: Permission): void {
  if (!actor.permissions.includes(permission)) throw new Error("FORBIDDEN");
}

export function requireTenant(actor: Actor, tenantId: string): void {
  if (actor.tenantId !== tenantId) throw new Error("TENANT_ACCESS_DENIED");
}
