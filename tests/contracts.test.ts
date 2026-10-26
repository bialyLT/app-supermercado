import { describe, expect, it } from "vitest";
import { assertTenantAccess, hasPermission } from "../src/domain/authorization";
import { tenantSchema } from "../src/domain/contracts";

describe("foundation contracts", () => {
  it("validates a tenant contract", () => {
    const result = tenantSchema.safeParse({
      id: "123e4567-e89b-42d3-a456-426614174000",
      name: "Kiosco Centro",
      slug: "kiosco-centro",
    });
    expect(result.success).toBe(true);
  });

  it("enforces permissions server-side", () => {
    expect(hasPermission("CASHIER", "settings:write")).toBe(false);
    expect(hasPermission("ADMIN", "settings:write")).toBe(true);
  });

  it("rejects resources from another tenant", () => {
    expect(() => assertTenantAccess("tenant-a", "tenant-b")).toThrow("TENANT_ACCESS_DENIED");
    expect(() => assertTenantAccess("tenant-a", "tenant-a")).not.toThrow();
  });
});
