import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ADMIN_NAV_ITEMS,
  getBreadcrumbs,
} from "../components/admin-navigation";
import { UsersManager } from "../components/admin-operations/users-manager";
import { SettingsManager } from "../components/admin-operations/settings-manager";
import { WeighedBarcodeManager } from "../components/admin-operations/weighed-barcode-manager";
import { SupplierManager } from "../components/suppliers/supplier-manager";

describe("Admin Operations Navigation Extensions (T6)", () => {
  it("includes /admin/suppliers in navigation for ADMIN and STOCK_MANAGER", () => {
    const suppliersItem = ADMIN_NAV_ITEMS.find((item) => item.href === "/admin/suppliers");
    expect(suppliersItem).toBeDefined();
    expect(suppliersItem?.label).toBe("Proveedores");
    expect(suppliersItem?.roles).toContain("ADMIN");
    expect(suppliersItem?.roles).toContain("STOCK_MANAGER");
    expect(suppliersItem?.roles).not.toContain("SUPERVISOR");
    expect(suppliersItem?.roles).not.toContain("CASHIER");
  });

  it("computes breadcrumbs for /admin/suppliers", () => {
    const crumbs = getBreadcrumbs("/admin/suppliers");
    expect(crumbs).toEqual([
      { label: "Inicio", href: "/admin" },
      { label: "Proveedores", href: "/admin/suppliers" },
    ]);
  });
});

describe("UsersManager Component", () => {
  const dummyBranches = [
    { id: "11111111-1111-1111-1111-111111111111", code: "B01", name: "Sucursal Central" },
    { id: "22222222-2222-2222-2222-222222222222", code: "B02", name: "Depósito Norte" },
  ];

  it("renders user registration form with all required fields and branch selector", () => {
    const html = renderToStaticMarkup(
      React.createElement(UsersManager, { branches: dummyBranches })
    );

    // Form fields
    expect(html).toContain('id="user-email"');
    expect(html).toContain('id="user-displayname"');
    expect(html).toContain('id="user-password"');
    expect(html).toContain('id="user-role"');
    expect(html).toContain('id="user-branch"');

    // Role options
    expect(html).toContain("CASHIER");
    expect(html).toContain("SUPERVISOR");
    expect(html).toContain("STOCK_MANAGER");
    expect(html).toContain("ADMIN");

    // Branch options
    expect(html).toContain("Sucursal Central");
    expect(html).toContain("Depósito Norte");

    // Empty state text for session log
    expect(html).toContain("No se han registrado usuarios en esta sesión");
  });
});

describe("SettingsManager Component", () => {
  const dummyBranches = [
    { id: "11111111-1111-1111-1111-111111111111", code: "B01", name: "Sucursal Central" },
  ];

  it("renders tenant settings form with presets and scope selector", () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsManager, { branches: dummyBranches })
    );

    expect(html).toContain('id="setting-key"');
    expect(html).toContain('id="setting-value"');
    expect(html).toContain('id="setting-branch"');
    expect(html).toContain("Tope de intake diario");
    expect(html).toContain("Zona horaria operativa");
    expect(html).toContain("No se han modificado parámetros en esta sesión");
  });
});

describe("WeighedBarcodeManager Component", () => {
  it("renders weighed barcode configuration form and preview simulator", () => {
    const html = renderToStaticMarkup(React.createElement(WeighedBarcodeManager));

    expect(html).toContain('id="wbc-prefix"');
    expect(html).toContain('id="wbc-mode"');
    expect(html).toContain('id="wbc-variant-digits"');
    expect(html).toContain('id="wbc-value-digits"');
    expect(html).toContain('id="wbc-value-scale"');
    expect(html).toContain("Simulador de Código EAN-13");
    expect(html).toContain("Longitud total");
  });
});

describe("SupplierManager Component", () => {
  const dummySuppliers = [
    {
      id: "sup-1",
      code: "PROV-001",
      name: "Distribuidora Lácteos SA",
      taxId: "30-12345678-9",
      email: "ventas@lacteos.com",
      phone: "+54 11 5555-1234",
      address: "Av. Corrientes 1234",
      active: true,
    },
  ];

  it("renders supplier table with supplied records and search filter", () => {
    const html = renderToStaticMarkup(
      React.createElement(SupplierManager, { initialSuppliers: dummySuppliers })
    );

    expect(html).toContain("PROV-001");
    expect(html).toContain("Distribuidora Lácteos SA");
    expect(html).toContain("30-12345678-9");
    expect(html).toContain("ventas@lacteos.com");
    expect(html).toContain('id="supplier-search"');
    expect(html).toContain("Nuevo Proveedor");
  });

  it("renders empty state when no suppliers exist", () => {
    const html = renderToStaticMarkup(
      React.createElement(SupplierManager, { initialSuppliers: [] })
    );

    expect(html).toContain("No hay proveedores registrados");
  });
});
