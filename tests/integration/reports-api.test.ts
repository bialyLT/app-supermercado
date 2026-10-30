import { describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/admin/reports/operations/route";

vi.mock("../../src/auth/authorization", () => ({ requirePermission: vi.fn() }));
vi.mock("../../src/auth/session", () => ({ getServerActor: vi.fn() }));
vi.mock("../../src/server/reports", () => ({
  getOperationsReport: vi.fn(),
  operationsReportCsv: vi.fn(),
}));

import { requirePermission } from "../../src/auth/authorization";
import { getServerActor } from "../../src/auth/session";
import { getOperationsReport, operationsReportCsv } from "../../src/server/reports";

const mockRequirePermission = vi.mocked(requirePermission);
const mockGetServerActor = vi.mocked(getServerActor);
const mockGetReport = vi.mocked(getOperationsReport);
const mockCsv = vi.mocked(operationsReportCsv);

const query = "from=2026-01-01T00%3A00%3A00.000Z&to=2026-02-01T00%3A00%3A00.000Z";
const actor = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  role: "ADMIN" as const,
  branchIds: [],
  permissions: ["inventory.write" as const],
};
const report = {
  period: { from: "2026-01-01T00:00:00.000Z", to: "2026-02-01T00:00:00.000Z" },
  filters: { from: "2026-01-01T00:00:00.000Z", to: "2026-02-01T00:00:00.000Z" },
  currency: "ARS",
  sales: { count: 0, total: "0.00", quantity: "0" },
  purchases: { count: 0, total: "0.00", taxTotal: "0.00", discountTotal: "0.00", quantity: "0" },
  transfers: { count: 0, outQuantity: "0", inQuantity: "0" },
  stock: { lineCount: 0, quantity: "0" },
  branches: [],
};

describe("operations report API", () => {
  it("returns JSON for an authorized actor", async () => {
    mockRequirePermission.mockResolvedValueOnce({ userId: actor.userId, tenantId: actor.tenantId, roles: ["ADMIN"], branchIds: [] });
    mockGetServerActor.mockResolvedValueOnce(actor);
    mockGetReport.mockResolvedValueOnce(report);
    const response = await GET(new Request(`http://localhost/api/admin/reports/operations?${query}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(report);
  });

  it("returns CSV with download headers", async () => {
    mockRequirePermission.mockResolvedValueOnce({ userId: actor.userId, tenantId: actor.tenantId, roles: ["ADMIN"], branchIds: [] });
    mockGetServerActor.mockResolvedValueOnce(actor);
    mockGetReport.mockResolvedValueOnce(report);
    mockCsv.mockReturnValueOnce("section,metric,value,currency\n");
    const response = await GET(new Request(`http://localhost/api/admin/reports/operations?${query}&format=csv`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("operations-report-2026-01-01-2026-02-01.csv");
    expect(await response.text()).toContain("section,metric");
  });

  it("returns 401 without a session", async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const response = await GET(new Request(`http://localhost/api/admin/reports/operations?${query}`));
    expect(response.status).toBe(401);
  });
});
