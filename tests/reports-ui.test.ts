import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildCsvExportUrl,
  buildReportQueryString,
  getPresetDateRange,
  mapReportErrorMessage,
  resolveBranchName,
  validateReportFilters,
  type OperationalBranch,
  type OperationsReportData,
  type ReportFilterState,
} from "../components/reports/types";
import { ReportsManager } from "../components/reports/reports-manager";
import { ReportFilters } from "../components/reports/report-filters";
import { ReportSummary } from "../components/reports/report-summary";
import { ReportBranchDetail } from "../components/reports/report-branch-detail";

const mockBranches: OperationalBranch[] = [
  { id: "11111111-1111-4111-8111-111111111111", code: "CEN", name: "Casa Central" },
  { id: "22222222-2222-4222-8222-222222222222", code: "NOR", name: "Sucursal Norte" },
];

const mockReportData: OperationsReportData = {
  period: {
    from: "2026-03-01T00:00:00.000Z",
    to: "2026-03-31T23:59:59.000Z",
  },
  filters: {
    from: "2026-03-01T00:00:00.000Z",
    to: "2026-03-31T23:59:59.000Z",
    branchId: "11111111-1111-4111-8111-111111111111",
  },
  currency: "ARS",
  sales: { count: 125, total: "154200.50", quantity: "340" },
  purchases: {
    count: 12,
    total: "89500.00",
    taxTotal: "18795.00",
    discountTotal: "1200.00",
    quantity: "510",
  },
  transfers: { count: 8, outQuantity: "45", inQuantity: "30" },
  stock: { lineCount: 85, quantity: "1420" },
  branches: [
    {
      branchId: "11111111-1111-4111-8111-111111111111",
      salesCount: 80,
      salesTotal: "98500.00",
      purchaseCount: 8,
      purchaseTotal: "60000.00",
      transferOutQuantity: "30",
      transferInQuantity: "10",
      stockQuantity: "900",
    },
    {
      branchId: "22222222-2222-4222-8222-222222222222",
      salesCount: 45,
      salesTotal: "55700.50",
      purchaseCount: 4,
      purchaseTotal: "29500.00",
      transferOutQuantity: "15",
      transferInQuantity: "20",
      stockQuantity: "520",
    },
  ],
};

describe("Reports UI — Filter validation and date presets (S3, S5)", () => {
  it("generates ascending ISO date ranges for presets", () => {
    const fixedNow = new Date("2026-03-15T12:00:00.000Z");
    const today = getPresetDateRange("today", fixedNow);
    expect(Date.parse(today.to)).toBeGreaterThan(Date.parse(today.from));
    expect(today.from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    const last7 = getPresetDateRange("last7days", fixedNow);
    expect(Date.parse(last7.to)).toBeGreaterThan(Date.parse(last7.from));

    const thisMonth = getPresetDateRange("thisMonth", fixedNow);
    expect(Date.parse(thisMonth.to)).toBeGreaterThan(Date.parse(thisMonth.from));
    expect(thisMonth.from).toContain("2026-03-01");
  });

  it("uses Argentina local midnight for the today preset", () => {
    const range = getPresetDateRange("today", new Date("2026-01-15T12:00:00.000Z"));
    expect(range.from).toBe("2026-01-15T03:00:00.000Z");
    expect(range.to).toBe("2026-01-16T03:00:00.000Z");
  });

  it("validates required ascending period and rejects to <= from", () => {
    const valid: ReportFilterState = {
      preset: "custom",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-02T00:00:00.000Z",
      branchId: "",
      actorUserId: "",
      variantId: "",
      categoryId: "",
    };
    expect(validateReportFilters(valid)).toEqual({});

    const invalidPeriod: ReportFilterState = {
      ...valid,
      from: "2026-03-05T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
    };
    const errors = validateReportFilters(invalidPeriod);
    expect(errors.to).toMatch(/posterior/i);

    const equalPeriod: ReportFilterState = {
      ...valid,
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-01T00:00:00.000Z",
    };
    expect(validateReportFilters(equalPeriod).to).toBeTruthy();
  });

  it("enforces server-derived branch authority and validates UUIDs", () => {
    const foreignBranch: ReportFilterState = {
      preset: "custom",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-02T00:00:00.000Z",
      branchId: "99999999-9999-4999-8999-999999999999",
      actorUserId: "",
      variantId: "",
      categoryId: "",
    };
    const branchError = validateReportFilters(foreignBranch, mockBranches);
    expect(branchError.branchId).toMatch(/no autorizada|no encontrada/i);

    const invalidUuidFilter: ReportFilterState = {
      ...foreignBranch,
      branchId: mockBranches[0].id,
      actorUserId: "not-a-uuid",
      variantId: "bad-variant",
      categoryId: "bad-category",
    };
    const uuidErrors = validateReportFilters(invalidUuidFilter, mockBranches);
    expect(uuidErrors.actorUserId).toBeTruthy();
    expect(uuidErrors.variantId).toBeTruthy();
    expect(uuidErrors.categoryId).toBeTruthy();
  });

  it("builds query strings without empty optional fields", () => {
    const filter: ReportFilterState = {
      preset: "custom",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-02T00:00:00.000Z",
      branchId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "",
      variantId: "",
      categoryId: "",
    };

    const qs = buildReportQueryString(filter, "json");
    expect(qs).toContain("from=2026-03-01T00%3A00%3A00.000Z");
    expect(qs).toContain("to=2026-03-02T00%3A00%3A00.000Z");
    expect(qs).toContain("branchId=11111111-1111-4111-8111-111111111111");
    expect(qs).toContain("format=json");
    expect(qs).not.toContain("actorUserId");
    expect(qs).not.toContain("variantId");
    expect(qs).not.toContain("categoryId");

    const csvUrl = buildCsvExportUrl(filter);
    expect(csvUrl).toContain("/api/admin/reports/operations?");
    expect(csvUrl).toContain("format=csv");
  });

  it("resolves branch names from operational context", () => {
    expect(resolveBranchName("11111111-1111-4111-8111-111111111111", mockBranches)).toBe("Casa Central (CEN)");
    expect(resolveBranchName("33333333-3333-4333-8333-333333333333", mockBranches)).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("maps report error codes to user-friendly messages", () => {
    expect(mapReportErrorMessage(400, "INVALID_PERIOD")).toMatch(/período/i);
    expect(mapReportErrorMessage(403, "FORBIDDEN")).toMatch(/permisos|sucursal/i);
    expect(mapReportErrorMessage(401, "UNAUTHENTICATED")).toMatch(/sesión/i);
    expect(mapReportErrorMessage(500, "UNKNOWN")).toMatch(/error/i);
  });
});

describe("Reports UI — Tabular display without charts (S2, S3, S5)", () => {
  it("renders tabular summary without chart elements (S2)", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReportSummary, { report: mockReportData })
    );

    // Strict S2: no charts or graphics
    expect(markup).not.toContain("<canvas");
    expect(markup).not.toContain("<svg class=\"recharts");
    expect(markup).not.toContain("chartjs");

    // Must be tabular presentation
    expect(markup).toContain("Resumen de Ventas");
    expect(markup).toContain("154200.50 ARS");
    expect(markup).toContain("89500.00 ARS");
    expect(markup).toContain("Resumen de Compras");
    expect(markup).toContain("Resumen de Transferencias");
    expect(markup).toContain("Resumen de Inventario");
  });

  it("renders branch detail table with resolved branch names (S3)", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReportBranchDetail, {
        branches: mockReportData.branches,
        operationalBranches: mockBranches,
        currency: "ARS",
      })
    );

    expect(markup).toContain("<table");
    expect(markup).toContain("Casa Central (CEN)");
    expect(markup).toContain("Sucursal Norte (NOR)");
    expect(markup).toContain("98500.00 ARS");
    expect(markup).toContain("55700.50 ARS");
  });

  it("renders explicit empty state when no branch data exists", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReportBranchDetail, {
        branches: [],
        operationalBranches: mockBranches,
        currency: "ARS",
      })
    );
    expect(markup).toContain("No se registraron movimientos");
  });

  it("renders filter controls with keyboard hints and branch options (S5)", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ReportFilters, {
        filters: {
          preset: "thisMonth",
          from: "2026-03-01T00:00:00.000Z",
          to: "2026-03-31T23:59:59.000Z",
          branchId: "",
          actorUserId: "",
          variantId: "",
          categoryId: "",
        },
        branches: mockBranches,
        onChange: () => {},
        onSubmit: () => {},
        onExportCsv: () => {},
        onReset: () => {},
        isLoading: false,
      })
    );

    // Keyboard hints
    expect(markup).toContain("Alt+C");
    expect(markup).toContain("Alt+E");
    expect(markup).toContain("Alt+L");

    // Filter inputs
    expect(markup).toContain("Casa Central (CEN)");
    expect(markup).toContain("Sucursal Norte (NOR)");
    expect(markup).toContain("Todas las sucursales");
  });

  it("renders ReportsManager with explicit initial, loading, and error states", () => {
    // Initial state with preloaded data
    const populated = renderToStaticMarkup(
      React.createElement(ReportsManager, {
        initialContext: { tenantId: "t-1", branches: mockBranches },
        initialReport: mockReportData,
      })
    );
    expect(populated).toContain("Reportes Operativos");
    expect(populated).toContain("154200.50 ARS");

    // Manager with explicit error state
    const errorMarkup = renderToStaticMarkup(
      React.createElement(ReportsManager, {
        initialContext: { tenantId: "t-1", branches: mockBranches },
        initialError: "El período 'Hasta' debe ser posterior a 'Desde'",
      })
    );
    expect(errorMarkup).toContain("role=\"alert\"");
    expect(errorMarkup).toContain("El período &#x27;Hasta&#x27; debe ser posterior a &#x27;Desde&#x27;");
  });
});
