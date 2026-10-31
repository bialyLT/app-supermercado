import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ADMIN_NAV_ITEMS,
  getBreadcrumbs,
  getVisibleNavItems,
  isRoleAuthorizedForAdmin,
  KEYBOARD_SHORTCUTS,
  ROLE_LABELS,
  type NavItem,
} from "../components/admin-navigation";
import { AdminShell } from "../components/admin-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("administrative shell navigation model", () => {
  it("enforces approved role mapping for ADMIN (tenant-wide manager)", () => {
    const items: NavItem[] = getVisibleNavItems("ADMIN");
    const hrefs = items.map((i) => i.href);

    expect(isRoleAuthorizedForAdmin("ADMIN")).toBe(true);
    // ADMIN has full tenant-wide access across all administrative modules (S3)
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/purchases");
    expect(hrefs).toContain("/admin/transfers");
    expect(hrefs).toContain("/admin/reports");
    expect(hrefs).toContain("/admin/promotions");
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/settings");
    expect(hrefs).toContain("/admin/weighed-barcode");
    expect(hrefs).toContain("/admin/cash-shifts");
    expect(hrefs).toContain("/pos");
  });

  it("enforces approved role mapping for STOCK_MANAGER (inventory manager)", () => {
    const items = getVisibleNavItems("STOCK_MANAGER");
    const hrefs = items.map((i) => i.href);

    expect(isRoleAuthorizedForAdmin("STOCK_MANAGER")).toBe(true);
    // Inventory manager has purchases, transfers, reports, pos, admin home
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/purchases");
    expect(hrefs).toContain("/admin/transfers");
    expect(hrefs).toContain("/admin/reports");
    expect(hrefs).toContain("/pos");

    // Inventory manager MUST NOT have settings, users, promotions, weighed-barcode
    expect(hrefs).not.toContain("/admin/promotions");
    expect(hrefs).not.toContain("/admin/users");
    expect(hrefs).not.toContain("/admin/settings");
    expect(hrefs).not.toContain("/admin/weighed-barcode");
    expect(hrefs).not.toContain("/admin/cash-shifts");
  });

  it("enforces approved role mapping for SUPERVISOR (shift/cash manager)", () => {
    const items = getVisibleNavItems("SUPERVISOR");
    const hrefs = items.map((i) => i.href);

    expect(isRoleAuthorizedForAdmin("SUPERVISOR")).toBe(true);
    // Supervisor has cash shifts / overrides, admin home, and POS
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/cash-shifts");
    expect(hrefs).toContain("/pos");

    // Supervisor MUST NOT have purchases, transfers, tenant settings, users, promotions
    expect(hrefs).not.toContain("/admin/purchases");
    expect(hrefs).not.toContain("/admin/transfers");
    expect(hrefs).not.toContain("/admin/settings");
    expect(hrefs).not.toContain("/admin/users");
    expect(hrefs).not.toContain("/admin/promotions");
    expect(hrefs).not.toContain("/admin/weighed-barcode");
  });

  it("enforces approved role mapping for CASHIER (operator without admin screens)", () => {
    const items = getVisibleNavItems("CASHIER");
    const hrefs = items.map((i) => i.href);

    // CASHIER is strictly an operator and has no administrative screens
    expect(isRoleAuthorizedForAdmin("CASHIER")).toBe(false);
    // Only POS is accessible to CASHIER
    expect(hrefs).toEqual(["/pos"]);
  });

  it("defines comprehensive descriptive metadata for all supported roles", () => {
    expect(ROLE_LABELS.ADMIN.title).toMatch(/Administrador|Tenant-wide/i);
    expect(ROLE_LABELS.STOCK_MANAGER.title).toMatch(/Inventario/i);
    expect(ROLE_LABELS.SUPERVISOR.title).toMatch(/Turno|Caja/i);
    expect(ROLE_LABELS.CASHIER.title).toMatch(/Cajero|Operador/i);
  });

  it("computes breadcrumbs accurately for nested administrative routes", () => {
    expect(getBreadcrumbs("/admin")).toEqual([{ label: "Inicio", href: "/admin" }]);
    expect(getBreadcrumbs("/admin/promotions")).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Promociones N×M", href: "/admin/promotions" },
    ]);
    expect(getBreadcrumbs("/admin/purchases")).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Compras", href: "/admin/purchases" },
    ]);
    expect(getBreadcrumbs("/admin/transfers")).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Transferencias", href: "/admin/transfers" },
    ]);
    expect(getBreadcrumbs("/admin/reports")).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Reportes", href: "/admin/reports" },
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
    expect(getBreadcrumbs("/admin/cash-shifts")).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Arqueos y Turnos", href: "/admin/cash-shifts" },
    ]);
  });

  it("exposes keyboard shortcuts including help, menu toggle, and fast navigation (S5)", () => {
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThanOrEqual(4);
    const shortcuts = KEYBOARD_SHORTCUTS.map((s) => s.key);
    expect(shortcuts).toContain("Alt+H");
    expect(shortcuts).toContain("Alt+P");
    expect(shortcuts).toContain("Alt+K");
    expect(shortcuts).toContain("Alt+M");
    expect(shortcuts).toContain("Escape");
  });

  it("contains navigation descriptors for all interface areas in scope (S3)", () => {
    expect(ADMIN_NAV_ITEMS.length).toBeGreaterThanOrEqual(10);
    const requiredHrefs = [
      "/admin",
      "/admin/purchases",
      "/admin/transfers",
      "/admin/reports",
      "/admin/promotions",
      "/admin/users",
      "/admin/settings",
      "/admin/weighed-barcode",
      "/admin/cash-shifts",
      "/pos",
    ];
    for (const href of requiredHrefs) {
      const match = ADMIN_NAV_ITEMS.find((item) => item.href === href);
      expect(match).toBeDefined();
      expect(match?.label.length).toBeGreaterThan(0);
      expect(match?.description).toBeDefined();
    }
  });

  describe("AdminShell component rendering invariants", () => {
    it("renders a visible logout control", () => {
      const html = renderToStaticMarkup(
        React.createElement(AdminShell, { initialRole: "ADMIN" }, React.createElement("div", null, "Child Content"))
      );
      expect(html).toContain("Cerrar sesión");
    });

    it("renders non-editable role badge and does not expose client-side role selector", () => {
      const html = renderToStaticMarkup(
        React.createElement(AdminShell, { initialRole: "STOCK_MANAGER" }, React.createElement("div", null, "Child Content"))
      );
      // Role is rendered as text badge
      expect(html).toContain("STOCK_MANAGER");
      // Interactive role-select must NOT exist
      expect(html).not.toContain('id="role-select"');
      expect(html).not.toContain("<select aria-label=\"Rol activo\"");
    });

    it("renders neutral empty state when no branches are supplied", () => {
      const html = renderToStaticMarkup(
        React.createElement(AdminShell, { initialRole: "ADMIN" }, React.createElement("div", null, "Child Content"))
      );
      // Empty state text rendered
      expect(html).toContain("Sin sucursales asignadas");
      // Branch selector select element must NOT exist
      expect(html).not.toContain('id="branch-select"');
      expect(html).not.toContain("Todas las sucursales (Tenant-wide)");
    });

    it("renders branch selector only when real branches are supplied", () => {
      const realBranches = [
        { id: "b1", name: "Sucursal Central 101" },
        { id: "b2", name: "Depósito Oeste" },
      ];
      const html = renderToStaticMarkup(
        React.createElement(AdminShell, { initialRole: "ADMIN", branches: realBranches }, React.createElement("div", null, "Child Content"))
      );
      expect(html).toContain('id="branch-select"');
      expect(html).toContain("Sucursal Central 101");
      expect(html).toContain("Depósito Oeste");
      expect(html).not.toContain("Sin sucursales asignadas");
    });

    it("renders restricted alert for CASHIER role without administrative navigation", () => {
      const html = renderToStaticMarkup(
        React.createElement(AdminShell, { initialRole: "CASHIER" }, React.createElement("div", null, "Secret Admin Panel"))
      );
      expect(html).toContain("Acceso no autorizado");
      expect(html).toContain("Ir al Punto de Venta (POS)");
      expect(html).not.toContain("Secret Admin Panel");
      expect(html).not.toContain("/admin/promotions");
      expect(html).not.toContain("/admin/purchases");
    });
  });
});
