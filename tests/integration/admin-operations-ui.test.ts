import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_ITEMS,
  getBreadcrumbs,
  getVisibleNavItems,
  isRoleAuthorizedForAdmin,
  KEYBOARD_SHORTCUTS,
} from "../../components/admin-navigation";
import { weighedBarcodeConfigSchema } from "../../src/domain/weighed-barcode";
import { supplierInputSchema } from "../../src/domain/purchases";
import { z } from "zod";

// Schema mirrors app/api/admin/settings/route.ts
const settingsSchema = z.object({
  setting: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(200),
  branchId: z.string().uuid().optional(),
}).strict();

// Schema mirrors app/api/admin/users/route.ts
const apiUserSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(128),
  role: z.enum(["CASHIER", "SUPERVISOR", "STOCK_MANAGER", "ADMIN"]),
  branchId: z.string().uuid().optional(),
}).strict();

describe("Epic 7 T6 Integration - Role Authorizations and Admin Module Boundaries", () => {
  it("verifies ADMIN has access to all operational and administrative endpoints", () => {
    expect(isRoleAuthorizedForAdmin("ADMIN")).toBe(true);
    const hrefs = getVisibleNavItems("ADMIN").map((i) => i.href);

    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/purchases");
    expect(hrefs).toContain("/admin/suppliers");
    expect(hrefs).toContain("/admin/transfers");
    expect(hrefs).toContain("/admin/reports");
    expect(hrefs).toContain("/admin/promotions");
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).toContain("/admin/weighed-barcode");
    expect(hrefs).toContain("/admin/cash-shifts");
    expect(hrefs).toContain("/pos");
  });

  it("verifies STOCK_MANAGER has inventory modules (purchases, suppliers, transfers, reports) but strictly no tenant admin", () => {
    expect(isRoleAuthorizedForAdmin("STOCK_MANAGER")).toBe(true);
    const hrefs = getVisibleNavItems("STOCK_MANAGER").map((i) => i.href);

    // Operational inventory modules allowed:
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/purchases");
    expect(hrefs).toContain("/admin/suppliers");
    expect(hrefs).toContain("/admin/transfers");
    expect(hrefs).toContain("/admin/reports");
    expect(hrefs).toContain("/pos");

    // Strictly forbidden for STOCK_MANAGER:
    expect(hrefs).not.toContain("/admin/promotions");
    expect(hrefs).not.toContain("/admin/users");
    expect(hrefs).not.toContain("/admin/settings");
    expect(hrefs).not.toContain("/admin/weighed-barcode");
    expect(hrefs).not.toContain("/admin/cash-shifts");
  });

  it("verifies SUPERVISOR has shift/cash supervision but no supplier or tenant admin", () => {
    expect(isRoleAuthorizedForAdmin("SUPERVISOR")).toBe(true);
    const hrefs = getVisibleNavItems("SUPERVISOR").map((i) => i.href);

    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/cash-shifts");
    expect(hrefs).toContain("/pos");

    expect(hrefs).not.toContain("/admin/purchases");
    expect(hrefs).not.toContain("/admin/suppliers");
    expect(hrefs).not.toContain("/admin/transfers");
    expect(hrefs).not.toContain("/admin/reports");
    expect(hrefs).not.toContain("/admin/promotions");
    expect(hrefs).not.toContain("/admin/users");
    expect(hrefs).not.toContain("/admin/settings");
    expect(hrefs).not.toContain("/admin/weighed-barcode");
  });

  it("verifies CASHIER is strictly restricted to POS terminal", () => {
    expect(isRoleAuthorizedForAdmin("CASHIER")).toBe(false);
    const hrefs = getVisibleNavItems("CASHIER").map((i) => i.href);
    expect(hrefs).toEqual(["/pos"]);
  });
});

describe("Epic 7 T6 Integration - Form Payloads against Server Zod Schemas", () => {
  it("validates user creation payload against API user schema", () => {
    const validPayload = {
      email: "cajero1@supermercado.com",
      displayName: "Carlos Cajero",
      password: "SecurePassword123!",
      role: "CASHIER" as const,
      branchId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    };

    const parsed = apiUserSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);

    // Password must be >= 12 chars
    const shortPassword = { ...validPayload, password: "short" };
    expect(apiUserSchema.safeParse(shortPassword).success).toBe(false);

    // Invalid email
    const invalidEmail = { ...validPayload, email: "not-an-email" };
    expect(apiUserSchema.safeParse(invalidEmail).success).toBe(false);

    // Unknown role
    const invalidRole = { ...validPayload, role: "MANAGER" };
    expect(apiUserSchema.safeParse(invalidRole).success).toBe(false);
  });

  it("validates settings payload against API settings schema", () => {
    const validTenantWide = {
      setting: "intake_cap",
      value: "1000000.00",
    };
    expect(settingsSchema.safeParse(validTenantWide).success).toBe(true);

    const validBranchScoped = {
      setting: "timezone",
      value: "America/Argentina/Cordoba",
      branchId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    };
    expect(settingsSchema.safeParse(validBranchScoped).success).toBe(true);

    // Empty setting key
    expect(settingsSchema.safeParse({ setting: "", value: "123" }).success).toBe(false);
    // Missing value
    expect(settingsSchema.safeParse({ setting: "cap" }).success).toBe(false);
  });

  it("validates weighed-barcode configuration against domain schema invariant", () => {
    // 2 (prefix) + 5 (variant) + 5 (value) = 12 total digits
    const validConfig = {
      prefix: "20",
      mode: "PRICE" as const,
      variantDigits: 5,
      valueDigits: 5,
      valueScale: 2,
    };
    expect(weighedBarcodeConfigSchema.safeParse(validConfig).success).toBe(true);

    // Invalid layout: 2 + 4 + 5 = 11 (!== 12)
    const invalidLayout = {
      prefix: "20",
      mode: "PRICE" as const,
      variantDigits: 4,
      valueDigits: 5,
      valueScale: 2,
    };
    const result = weighedBarcodeConfigSchema.safeParse(invalidLayout);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("INVALID_EAN13_LAYOUT");
    }

    // Invalid non-digit prefix
    expect(weighedBarcodeConfigSchema.safeParse({ ...validConfig, prefix: "AB" }).success).toBe(false);
  });

  it("validates supplier input against domain schema", () => {
    const validSupplier = {
      code: "PROV-001",
      name: "Distribuidora Mayorista SRL",
      taxId: "30-99999999-7",
      email: "pedidos@mayorista.com",
      phone: "+54 11 4000-0000",
      address: "Av. Industrial 123",
      active: true,
    };
    expect(supplierInputSchema.safeParse(validSupplier).success).toBe(true);

    // Code and name required
    expect(supplierInputSchema.safeParse({ name: "Solo Nombre" }).success).toBe(false);
    expect(supplierInputSchema.safeParse({ code: "Solo Codigo" }).success).toBe(false);
  });
});

describe("Epic 7 T6 Integration - Breadcrumbs and Navigation Consistency", () => {
  it("computes complete breadcrumb lineages for all operations routes", () => {
    const operationsRoutes = [
      { path: "/admin/suppliers", expected: "Proveedores" },
      { path: "/admin/users", expected: "Usuarios" },
      { path: "/admin/settings", expected: "Configuración" },
      { path: "/admin/weighed-barcode", expected: "Códigos pesables" },
    ];

    for (const { path, expected } of operationsRoutes) {
      const crumbs = getBreadcrumbs(path);
      expect(crumbs).toHaveLength(2);
      expect(crumbs[0]).toEqual({ label: "Inicio", href: "/admin" });
      expect(crumbs[1]).toEqual({ label: expected, href: path });
    }
  });

  it("verifies all keyboard shortcuts and navigation shortcuts are distinct and documented", () => {
    const itemShortcuts = ADMIN_NAV_ITEMS.map((i) => i.shortcut).filter(Boolean);
    const uniqueItemShortcuts = new Set(itemShortcuts);
    expect(itemShortcuts.length).toBe(uniqueItemShortcuts.size);

    // Critical global shortcuts
    const globalKeys = KEYBOARD_SHORTCUTS.map((k) => k.key);
    expect(globalKeys).toContain("Alt+H");
    expect(globalKeys).toContain("Alt+P");
    expect(globalKeys).toContain("Alt+K");
    expect(globalKeys).toContain("Alt+M");
    expect(globalKeys).toContain("Escape");
  });
});
