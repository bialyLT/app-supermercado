import { describe, expect, it, vi } from "vitest";
import { GET as getLevels } from "../../app/api/admin/inventory/levels/route";
import { GET as getMovements } from "../../app/api/admin/inventory/movements/route";
import { GET as getSales } from "../../app/api/admin/sales/route";
import { GET as getSale } from "../../app/api/admin/sales/[id]/route";
import { GET as getCash } from "../../app/api/admin/cash-shifts/history/route";

vi.mock("../../src/auth/authorization", () => ({ requirePermission: vi.fn() }));
vi.mock("../../src/auth/session", () => ({ getServerActor: vi.fn() }));
vi.mock("../../src/server/operational-read", () => ({
  operationalReadQuerySchema: { parse: (value: Record<string, string>) => ({ ...value, limit: value.limit ? Number(value.limit) : 50 }) },
  listInventoryLevels: vi.fn(),
  listInventoryMovements: vi.fn(),
  listSales: vi.fn(),
  getSale: vi.fn(),
  listCashShifts: vi.fn(),
}));

import { requirePermission } from "../../src/auth/authorization";
import { getServerActor } from "../../src/auth/session";
import { getSale as readSale, listCashShifts, listInventoryLevels, listInventoryMovements, listSales } from "../../src/server/operational-read";
import { InventoryError } from "../../src/domain/inventory";

const actor = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  role: "ADMIN" as const,
  branchIds: ["33333333-3333-4333-8333-333333333333"],
  permissions: [],
};
const identity = {
  userId: actor.userId,
  tenantId: actor.tenantId,
  roles: ["ADMIN" as const],
  branchIds: actor.branchIds,
};
const id = "44444444-4444-4444-8444-444444444444";

describe("operational read HTTP contracts", () => {
  it("returns 401 without a session and does not invoke a repository", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    const response = await getLevels(new Request("http://localhost/api/admin/inventory/levels"));
    expect(response.status).toBe(401);
    expect(listInventoryLevels).not.toHaveBeenCalled();
  });

  it("returns 403 for an insufficient role", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new Error("FORBIDDEN"));
    const response = await getCash(new Request("http://localhost/api/admin/cash-shifts/history"));
    expect(response.status).toBe(403);
    expect(listCashShifts).not.toHaveBeenCalled();
  });

  it("uses canonical permissions and server actor tenant for every collection", async () => {
    vi.mocked(requirePermission).mockResolvedValue(identity);
    vi.mocked(getServerActor).mockResolvedValue(actor);
    vi.mocked(listInventoryLevels).mockResolvedValue({ levels: [], limit: 50 });
    vi.mocked(listInventoryMovements).mockResolvedValue({ movements: [] });
    vi.mocked(listSales).mockResolvedValue({ sales: [], limit: 50 });
    vi.mocked(listCashShifts).mockResolvedValue({ shifts: [] });

    expect((await getLevels(new Request("http://localhost/api/admin/inventory/levels?tenantId=foreign"))).status).toBe(200);
    expect((await getMovements(new Request("http://localhost/api/admin/inventory/movements"))).status).toBe(200);
    expect((await getSales(new Request("http://localhost/api/admin/sales"))).status).toBe(200);
    expect((await getCash(new Request("http://localhost/api/admin/cash-shifts/history"))).status).toBe(200);
    expect(vi.mocked(requirePermission).mock.calls.map(([permission]) => permission)).toEqual([
      "inventory.level.read", "inventory.ledger.read", "sales.read", "cash.history.read",
    ]);
    expect(vi.mocked(listSales).mock.calls[0]?.[0].tenantId).toBe(actor.tenantId);
  });

  it("returns Decimal strings in detail and hides a foreign sale as 404", async () => {
    vi.mocked(requirePermission).mockResolvedValue(identity);
    vi.mocked(getServerActor).mockResolvedValue(actor);
    vi.mocked(readSale).mockResolvedValue({
      id, documentNumber: 7, branchId: actor.branchIds[0], locationId: id, registerSessionId: id, actorUserId: actor.userId,
      total: "12.34", currency: "ARS", createdAt: "2026-01-01T00:00:00.000Z",
      lines: [{ id, variantId: id, productName: "Producto", quantity: "1.000", unitPrice: "12.34", sourceSnapshot: null }],
      payments: [{ id, method: "CASH", amount: "12.34", currency: "ARS" }],
    });
    const response = await getSale(new Request("http://localhost"), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect((await response.json()).total).toBe("12.34");
    vi.mocked(readSale).mockRejectedValueOnce(new InventoryError("NOT_FOUND"));
    const missing = await getSale(new Request("http://localhost"), { params: Promise.resolve({ id }) });
    expect(missing.status).toBe(404);
  });
});
