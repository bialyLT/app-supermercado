import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OperationalRead, SaleDetail } from "../components/operational-read/operational-read";
import { formatCurrency, formatQuantity, parseDateTimeLocal } from "../src/client/presentation";
import { getBreadcrumbs, getVisibleNavItems } from "../components/admin-navigation";
import { operationalReadQuerySchema } from "../src/server/operational-read";

describe("operational read UI", () => {
  it("renders read-only inventory filters and loading state", () => {
    const markup = renderToStaticMarkup(React.createElement(OperationalRead, { surface: "inventory" }));
    expect(markup).toContain("Inventario");
    expect(markup).toContain("Aplicar filtros");
    expect(markup).toContain("Cargando datos");
    expect(markup).toContain("Ubicación");
  });

  it("keeps operational routes role-aware", () => {
    expect(getVisibleNavItems("CASHIER").map((item) => item.href)).toEqual(["/pos"]);
    expect(getVisibleNavItems("STOCK_MANAGER").map((item) => item.href)).toContain("/admin/inventory");
    expect(getVisibleNavItems("SUPERVISOR").map((item) => item.href)).toContain("/admin/sales");
    expect(getVisibleNavItems("SUPERVISOR").map((item) => item.href)).toContain("/admin/cash-shifts/history");
  });

  it("exposes nested route breadcrumbs", () => {
    expect(getBreadcrumbs("/admin/cash-shifts/history").at(-1)).toEqual({
      label: "Historial de caja",
      href: "/admin/cash-shifts/history",
    });
  });

  it("preserves Decimal strings for quantities and money", () => {
    expect(formatQuantity("0.000")).toBe("0");
    expect(formatQuantity("-1.250")).toBe("-1.25");
    expect(formatCurrency("1234.50", "ARS")).toContain("1.234,50");
    expect(formatCurrency("-0.125", "ARS")).toContain("-0,13");
  });

  it("renders a sale detail loading state without mutating data", () => {
    const markup = renderToStaticMarkup(React.createElement(SaleDetail, { saleId: "sale-id" }));
    expect(markup).toContain("Cargando venta");
  });

  it("rejects inverted operational date ranges", () => {
    expect(() => operationalReadQuerySchema.parse({
      from: "2026-02-02T00:00:00.000Z",
      to: "2026-02-01T00:00:00.000Z",
    })).toThrow();
  });

  it("renders missing cash amounts as unavailable instead of zero", () => {
    expect(formatCurrency(null, "ARS")).toContain("No disponible");
  });

  it("rejects impossible datetime-local values without RangeError", () => {
    expect(() => parseDateTimeLocal("2026-02-30T10:00")).toThrow("Invalid local date");
  });

  it("exposes retry and filter-preserving detail navigation", () => {
    const markup = renderToStaticMarkup(React.createElement(OperationalRead, { surface: "sales" }));
    expect(markup).toContain("Aplicar filtros");
    expect(markup).toContain("Cargando datos");
  });
});
