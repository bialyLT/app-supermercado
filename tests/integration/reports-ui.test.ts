import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { operationsReportQuerySchema } from "../../src/domain/reports";
import {
  buildReportQueryString,
  getPresetDateRange,
  validateReportFilters,
  type OperationalBranch,
  type ReportFilterState,
} from "../../components/reports/types";
import ReportsPage from "../../app/admin/reports/page";
import ReportsLoading from "../../app/admin/reports/loading";

describe("Reports UI Integration — SSR, Schema Alignment & Authority (S2, S3, S5)", () => {
  it("renders ReportsPage Server Component gracefully when unauthenticated or without DB", async () => {
    const pageElement = await ReportsPage();
    expect(React.isValidElement(pageElement)).toBe(true);
    const html = renderToStaticMarkup(pageElement);

    // Title and structure
    expect(html).toContain("Reportes Operativos");
    expect(html).toContain("Parámetros del Reporte");

    // S5: keyboard shortcuts visible
    expect(html).toContain("Alt+C");
    expect(html).toContain("Alt+E");
    expect(html).toContain("Alt+L");

    // S2: No charts
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain("<svg class=\"recharts");
  });

  it("renders ReportsLoading skeleton with accessible status attributes", () => {
    const loadingElement = React.createElement(ReportsLoading);
    const html = renderToStaticMarkup(loadingElement);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Cargando interfaz de reportes operativos");
  });

  it("guarantees buildReportQueryString generates queries that strictly satisfy operationsReportQuerySchema", () => {
    const range = getPresetDateRange("thisMonth", new Date("2026-03-15T00:00:00.000Z"));
    const branchId = "11111111-1111-4111-8111-111111111111";
    const actorUserId = "22222222-2222-4222-8222-222222222222";
    const variantId = "33333333-3333-4333-8333-333333333333";
    const categoryId = "44444444-4444-4444-8444-444444444444";

    const filterState: ReportFilterState = {
      preset: "thisMonth",
      from: range.from,
      to: range.to,
      branchId,
      actorUserId,
      variantId,
      categoryId,
    };

    // Test JSON format query string
    const jsonQs = buildReportQueryString(filterState, "json");
    const jsonParams = Object.fromEntries(new URLSearchParams(jsonQs).entries());
    const parsedJson = operationsReportQuerySchema.safeParse(jsonParams);
    expect(parsedJson.success).toBe(true);
    if (parsedJson.success) {
      expect(parsedJson.data.from).toBe(range.from);
      expect(parsedJson.data.to).toBe(range.to);
      expect(parsedJson.data.branchId).toBe(branchId);
      expect(parsedJson.data.actorUserId).toBe(actorUserId);
      expect(parsedJson.data.variantId).toBe(variantId);
      expect(parsedJson.data.categoryId).toBe(categoryId);
      expect(parsedJson.data.format).toBe("json");
    }

    // Test CSV format query string
    const csvQs = buildReportQueryString(filterState, "csv");
    const csvParams = Object.fromEntries(new URLSearchParams(csvQs).entries());
    const parsedCsv = operationsReportQuerySchema.safeParse(csvParams);
    expect(parsedCsv.success).toBe(true);
    if (parsedCsv.success) {
      expect(parsedCsv.data.format).toBe("csv");
    }
  });

  it("rejects unauthorized client branch manipulation against server-derived context", () => {
    const serverBranches: OperationalBranch[] = [
      { id: "11111111-1111-4111-8111-111111111111", code: "CEN", name: "Central" },
    ];

    const injectedState: ReportFilterState = {
      preset: "custom",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-02T00:00:00.000Z",
      branchId: "99999999-9999-4999-8999-999999999999", // foreign / unassigned
      actorUserId: "",
      variantId: "",
      categoryId: "",
    };

    const errors = validateReportFilters(injectedState, serverBranches);
    expect(errors.branchId).toBeDefined();
    expect(errors.branchId).toMatch(/no autorizada|no encontrada/i);
  });
});
