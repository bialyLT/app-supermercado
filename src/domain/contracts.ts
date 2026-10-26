import { z } from "zod";

export const tenantIdSchema = z.string().uuid();
export const roleNameSchema = z.enum(["CASHIER", "SUPERVISOR", "STOCK_MANAGER", "ADMIN"]);

export const tenantSchema = z.object({
  id: tenantIdSchema,
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80),
});

export const storeSchema = z.object({
  id: tenantIdSchema,
  tenantId: tenantIdSchema,
  name: z.string().trim().min(1).max(120),
});

export const branchSchema = storeSchema.extend({
  code: z.string().trim().min(1).max(32),
});

export const cashRegisterSchema = z.object({
  id: tenantIdSchema,
  tenantId: tenantIdSchema,
  branchId: tenantIdSchema,
  name: z.string().trim().min(1).max(80),
});

export const userSchema = z.object({
  id: tenantIdSchema,
  tenantId: tenantIdSchema,
  email: z.string().email(),
  displayName: z.string().trim().min(1).max(120),
});

export const roleSchema = z.object({
  id: tenantIdSchema,
  tenantId: tenantIdSchema,
  name: roleNameSchema,
});

export const auditLogSchema = z.object({
  id: tenantIdSchema,
  tenantId: tenantIdSchema,
  actorUserId: tenantIdSchema.nullable(),
  action: z.string().trim().min(1).max(120),
  entityType: z.string().trim().min(1).max(80),
  entityId: tenantIdSchema.nullable(),
  previousValue: z.record(z.string(), z.unknown()).nullable(),
  newValue: z.record(z.string(), z.unknown()).nullable(),
  ipAddress: z.string().max(64).nullable(),
});

export type RoleName = z.infer<typeof roleNameSchema>;
export type Tenant = z.infer<typeof tenantSchema>;
export type Store = z.infer<typeof storeSchema>;
export type Branch = z.infer<typeof branchSchema>;
export type CashRegister = z.infer<typeof cashRegisterSchema>;
export type User = z.infer<typeof userSchema>;
export type Role = z.infer<typeof roleSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
