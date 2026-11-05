import { describe, expect, it } from "vitest";
import type { RoleName } from "../src/domain/contracts";
import {
  ADMIN_NAV_ITEMS,
  getBreadcrumbs,
  getVisibleNavItems,
  NAV_GROUPS,
  type NavItem,
} from "./admin-navigation";

describe("Admin Navigation - grouped sidebar (T2)", () => {
  it("groups every existing navigation item exactly once and keeps every role rule intact", () => {
    // Grouping must cover ADMIN_NAV_ITEMS exactly: no item lost, none duplicated.
    expect(NAV_GROUPS.length).toBeGreaterThanOrEqual(2);
    const groupedHrefs = NAV_GROUPS.flatMap((group) =>
      ADMIN_NAV_ITEMS.filter((item) => item.group === group.id).map((item) => item.href)
    );
    expect(groupedHrefs).toHaveLength(ADMIN_NAV_ITEMS.length);
    expect(new Set(groupedHrefs).size).toBe(ADMIN_NAV_ITEMS.length);
    expect([...groupedHrefs].sort()).toEqual(
      [...ADMIN_NAV_ITEMS.map((item) => item.href)].sort()
    );

    // Role visibility rules stay exactly as they were before grouping was introduced.
    const expectedByRole: Record<RoleName, readonly string[]> = {
      ADMIN: [
        "/admin",
        "/admin/purchases",
        "/admin/suppliers",
        "/admin/transfers",
        "/admin/reports",
        "/admin/promotions",
        "/admin/users",
        "/admin/settings",
        "/admin/weighed-barcode",
        "/admin/cash-shifts",
        "/pos",
      ],
      STOCK_MANAGER: [
        "/admin",
        "/admin/purchases",
        "/admin/suppliers",
        "/admin/transfers",
        "/admin/reports",
        "/pos",
      ],
      SUPERVISOR: ["/admin", "/admin/cash-shifts", "/pos"],
      CASHIER: ["/pos"],
    };
    for (const role of Object.keys(expectedByRole) as RoleName[]) {
      expect(getVisibleNavItems(role).map((item) => item.href)).toEqual(expectedByRole[role]);
    }
  });
});

describe("Admin Navigation - Suppliers and Operations Routes (T6)", () => {
  it("includes /admin/suppliers in ADMIN_NAV_ITEMS with appropriate roles and description", () => {
    const suppliersItem = ADMIN_NAV_ITEMS.find((item) => item.href === "/admin/suppliers");
    expect(suppliersItem).toBeDefined();
    expect(suppliersItem?.label).toBe("Proveedores");
    expect(suppliersItem?.roles).toContain("ADMIN");
    expect(suppliersItem?.roles).toContain("STOCK_MANAGER");
    expect(suppliersItem?.roles).not.toContain("SUPERVISOR");
    expect(suppliersItem?.roles).not.toContain("CASHIER");
    expect(suppliersItem?.description).toBeDefined();
    expect(suppliersItem?.shortcut).toBe("Alt+V");
  });

  it("exposes /admin/suppliers to ADMIN and STOCK_MANAGER roles", () => {
    const adminHrefs = getVisibleNavItems("ADMIN").map((i: NavItem) => i.href);
    const stockHrefs = getVisibleNavItems("STOCK_MANAGER").map((i: NavItem) => i.href);
    const supervisorHrefs = getVisibleNavItems("SUPERVISOR").map((i: NavItem) => i.href);
    const cashierHrefs = getVisibleNavItems("CASHIER").map((i: NavItem) => i.href);

    expect(adminHrefs).toContain("/admin/suppliers");
    expect(stockHrefs).toContain("/admin/suppliers");
    expect(supervisorHrefs).not.toContain("/admin/suppliers");
    expect(cashierHrefs).not.toContain("/admin/suppliers");
  });

  it("preserves strict access control for settings, users, and weighed-barcode to ADMIN only", () => {
    const adminHrefs = getVisibleNavItems("ADMIN").map((i: NavItem) => i.href);
    const stockHrefs = getVisibleNavItems("STOCK_MANAGER").map((i: NavItem) => i.href);
    const supervisorHrefs = getVisibleNavItems("SUPERVISOR").map((i: NavItem) => i.href);

    expect(adminHrefs).toContain("/admin/users");
    expect(adminHrefs).toContain("/admin/settings");
    expect(adminHrefs).toContain("/admin/weighed-barcode");

    expect(stockHrefs).not.toContain("/admin/users");
    expect(stockHrefs).not.toContain("/admin/settings");
    expect(stockHrefs).not.toContain("/admin/weighed-barcode");

    expect(supervisorHrefs).not.toContain("/admin/users");
    expect(supervisorHrefs).not.toContain("/admin/settings");
    expect(supervisorHrefs).not.toContain("/admin/weighed-barcode");
  });

  it("computes accurate breadcrumbs for all admin operations routes", () => {
    expect(getBreadcrumbs("/admin/suppliers")).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Proveedores", href: "/admin/suppliers" },
    ]);
    expect(getBreadcrumbs("/admin/users")).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Usuarios", href: "/admin/users" },
    ]);
    expect(getBreadcrumbs("/admin/settings")).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Configuración", href: "/admin/settings" },
    ]);
    expect(getBreadcrumbs("/admin/weighed-barcode")).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Códigos pesables", href: "/admin/weighed-barcode" },
    ]);
  });
});
