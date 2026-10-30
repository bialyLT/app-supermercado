import { describe, expect, it } from "vitest";
import { operationsReportCsv, type OperationsReport } from "../src/server/reports";
import { ReportError, operationsReportQuerySchema, reportHttpStatus } from "../src/domain/reports";

describe("operations reports", () => {
  const period = { from: "2026-01-01T00:00:00.000Z", to: "2026-02-01T00:00:00.000Z" };

  it("requires an ascending period", () => {
    expect(() => operationsReportQuerySchema.parse({ from: period.to, to: period.from })).toThrow("REPORT_PERIOD_MUST_ASCEND");
  });

  it("maps report errors and defaults to JSON", () => {
    expect(operationsReportQuerySchema.parse(period).format).toBe("json");
    expect(reportHttpStatus(new ReportError("UNAUTHENTICATED"))).toBe(401);
    expect(reportHttpStatus(new ReportError("FORBIDDEN"))).toBe(403);
    expect(reportHttpStatus(new ReportError("INVALID_PERIOD"))).toBe(400);
    expect(reportHttpStatus(new ReportError("UNKNOWN"))).toBe(400);
  });

  it("accepts branch, user, product, category and CSV filters", () => {
    const parsed = operationsReportQuerySchema.parse({
      ...period,
      branchId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      variantId: "33333333-3333-4333-8333-333333333333",
      categoryId: "44444444-4444-4444-8444-444444444444",
      format: "csv",
    });
    expect(parsed.format).toBe("csv");
  });

  it("escapes CSV cells and includes branch breakdowns", () => {
    const report: OperationsReport = {
      period,
      filters: period,
      currency: "ARS",
      sales: { count: 1, total: "10.00", quantity: "2" },
      purchases: { count: 1, total: "5.00", taxTotal: "1.00", discountTotal: "0.00", quantity: "3" },
      transfers: { count: 1, outQuantity: "1", inQuantity: "1" },
      stock: { lineCount: 1, quantity: "4" },
      branches: [{ branchId: "branch,one", salesCount: 1, salesTotal: "10.00", purchaseCount: 1, purchaseTotal: "5.00", transferOutQuantity: "1", transferInQuantity: "1", stockQuantity: "4" }],
    };
    const csv = operationsReportCsv(report);
    expect(csv).toContain("section,metric,value,currency");
    expect(csv).toContain('"branch,one:sales_total"');
  });
});
