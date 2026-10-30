import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_ITEMS,
  getBreadcrumbs,
  getVisibleNavItems,
  isRoleAuthorizedForAdmin,
  KEYBOARD_SHORTCUTS,
  ROLE_LABELS,
} from "../../components/admin-navigation";
import type { RoleName } from "../../src/domain/contracts";

describe("admin shell integration and invariants", () => {
  const allRoles: readonly RoleName[] = ["ADMIN", "STOCK_MANAGER", "SUPERVISOR", "CASHIER"];

  it("verifies every role has distinct and documented boundaries", () => {
    for (const role of allRoles) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(ROLE_LABELS[role].title.length).toBeGreaterThan(0);
      expect(ROLE_LABELS[role].description.length).toBeGreaterThan(0);
    }
  });

  it("preserves server authorization contract: CASHIER is strictly non-administrative", () => {
    expect(isRoleAuthorizedForAdmin("CASHIER")).toBe(false);
    const cashierNav = getVisibleNavItems("CASHIER");
    expect(cashierNav.every((item) => item.href === "/pos")).toBe(true);
  });

  it("ensures STOCK_MANAGER only accesses operational inventory modules", () => {
    const stockNav = getVisibleNavItems("STOCK_MANAGER").map((i) => i.href);
    // Allowed:
    expect(stockNav).toContain("/admin");
    expect(stockNav).toContain("/admin/purchases");
    expect(stockNav).toContain("/admin/transfers");
    expect(stockNav).toContain("/admin/reports");
    expect(stockNav).toContain("/pos");

    // Strictly forbidden:
    expect(stockNav).not.toContain("/admin/promotions");
    expect(stockNav).not.toContain("/admin/users");
    expect(stockNav).not.toContain("/admin/settings");
    expect(stockNav).not.toContain("/admin/weighed-barcode");
    expect(stockNav).not.toContain("/admin/cash-shifts");
  });

  it("ensures SUPERVISOR only accesses shift, cash override, and approval modules", () => {
    const supervisorNav = getVisibleNavItems("SUPERVISOR").map((i) => i.href);
    // Allowed:
    expect(supervisorNav).toContain("/admin");
    expect(supervisorNav).toContain("/admin/cash-shifts");
    expect(supervisorNav).toContain("/pos");

    // Strictly forbidden:
    expect(supervisorNav).not.toContain("/admin/purchases");
    expect(supervisorNav).not.toContain("/admin/transfers");
    expect(supervisorNav).not.toContain("/admin/promotions");
    expect(supervisorNav).not.toContain("/admin/users");
    expect(supervisorNav).not.toContain("/admin/settings");
    expect(supervisorNav).not.toContain("/admin/weighed-barcode");
  });

  it("verifies breadcrumb hierarchy consistency across all admin subroutes", () => {
    for (const item of ADMIN_NAV_ITEMS) {
      if (item.href === "/pos") continue;
      const crumbs = getBreadcrumbs(item.href);
      expect(crumbs[0]).toEqual({ label: "Inicio", href: "/admin" });
      if (item.href !== "/admin") {
        expect(crumbs.length).toBe(2);
        expect(crumbs[1].href).toBe(item.href);
        expect(crumbs[1].label).toBe(item.label);
      }
    }
  });

  it("verifies keyboard shortcuts are unique and include critical actions", () => {
    const keys = KEYBOARD_SHORTCUTS.map((s) => s.key);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
    expect(keys).toContain("Alt+H");
    expect(keys).toContain("Alt+P");
    expect(keys).toContain("Alt+K");
    expect(keys).toContain("Alt+M");
    expect(keys).toContain("Escape");
  });
});
