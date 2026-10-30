import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Actor } from "../src/domain/actor";

vi.mock("../src/server/repositories/client", () => ({
  prisma: {},
}));

vi.mock("../src/server/repositories/tenant-context", () => ({
  withTenant: vi.fn((_client, _actor, op) => op(mockTx)),
}));

const mockTx = {
  branch: {
    findMany: vi.fn(),
  },
  location: {
    findMany: vi.fn(),
  },
};

import {
  ContextError,
  contextHttpStatus,
  verifyContextPermission,
} from "../src/server/repositories/context";
import { getOperationalContext } from "../src/server/context";

describe("operational context domain rules and permissions", () => {
  const stockManagerActor: Actor = {
    tenantId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    role: "STOCK_MANAGER",
    branchIds: ["33333333-3333-4333-8333-333333333333"],
    permissions: ["inventory.write", "inventory.receive", "inventory.transfer"],
  };

  const adminActor: Actor = {
    tenantId: "11111111-1111-4111-8111-111111111111",
    userId: "44444444-4444-4444-8444-444444444444",
    role: "ADMIN",
    branchIds: [],
    permissions: ["inventory.write", "inventory.policy.manage"],
  };

  const cashierActor: Actor = {
    tenantId: "11111111-1111-4111-8111-111111111111",
    userId: "55555555-5555-4555-8555-555555555555",
    role: "CASHIER",
    branchIds: ["33333333-3333-4333-8333-333333333333"],
    permissions: ["inventory.sell"],
  };

  const supervisorActor: Actor = {
    tenantId: "11111111-1111-4111-8111-111111111111",
    userId: "66666666-6666-4666-8666-666666666666",
    role: "SUPERVISOR",
    branchIds: ["33333333-3333-4333-8333-333333333333"],
    permissions: ["inventory.sale.approve"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes ADMIN and STOCK_MANAGER roles", () => {
    expect(() => verifyContextPermission(adminActor)).not.toThrow();
    expect(() => verifyContextPermission(stockManagerActor)).not.toThrow();
  });

  it("rejects unauthorized roles (CASHIER, SUPERVISOR) without inventory permissions", () => {
    expect(() => verifyContextPermission(cashierActor)).toThrow(ContextError);
    expect(() => verifyContextPermission(supervisorActor)).toThrow(ContextError);
  });

  it("maps ContextError codes to proper HTTP status codes", () => {
    expect(contextHttpStatus(new ContextError("UNAUTHENTICATED"))).toBe(401);
    expect(contextHttpStatus(new ContextError("FORBIDDEN"))).toBe(403);
    expect(contextHttpStatus(new ContextError("NOT_FOUND"))).toBe(404);
  });

  it("fetches tenant-scoped assigned branches and active locations for STOCK_MANAGER", async () => {
    const branchId = "33333333-3333-4333-8333-333333333333";
    const locationId = "loc-1";

    mockTx.branch.findMany.mockResolvedValueOnce([
      { id: branchId, code: "B1", name: "Branch One" },
    ]);
    mockTx.location.findMany.mockResolvedValueOnce([
      {
        id: locationId,
        code: "L1",
        name: "Main Storage",
        type: "WAREHOUSE",
        branchId,
        active: true,
      },
    ]);

    const result = await getOperationalContext(stockManagerActor);

    expect(result.tenantId).toBe(stockManagerActor.tenantId);
    expect(result.branches).toEqual([
      {
        id: branchId,
        code: "B1",
        name: "Branch One",
        locations: [
          {
            id: locationId,
            code: "L1",
            name: "Main Storage",
            type: "WAREHOUSE",
            branchId,
            active: true,
          },
        ],
      },
    ]);
    expect(result.locations).toEqual([
      {
        id: locationId,
        code: "L1",
        name: "Main Storage",
        type: "WAREHOUSE",
        branchId,
        active: true,
      },
    ]);

    expect(mockTx.branch.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: stockManagerActor.tenantId,
        id: { in: stockManagerActor.branchIds },
      },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });

    expect(mockTx.location.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: stockManagerActor.tenantId,
        active: true,
        branchId: { in: [branchId] },
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        branchId: true,
        active: true,
      },
      orderBy: { name: "asc" },
    });
  });

  it("fetches all tenant branches for ADMIN with empty branchIds", async () => {
    mockTx.branch.findMany.mockResolvedValueOnce([
      { id: "b1", code: "B1", name: "Branch 1" },
      { id: "b2", code: "B2", name: "Branch 2" },
    ]);
    mockTx.location.findMany.mockResolvedValueOnce([]);

    const result = await getOperationalContext(adminActor);

    expect(mockTx.branch.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: adminActor.tenantId,
      },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    });
    expect(result.branches).toHaveLength(2);
  });

  it("returns empty lists when actor has no accessible branches", async () => {
    const unassignedManager: Actor = {
      ...stockManagerActor,
      branchIds: [],
    };

    mockTx.branch.findMany.mockResolvedValueOnce([]);

    const result = await getOperationalContext(unassignedManager);

    expect(result.branches).toEqual([]);
    expect(result.locations).toEqual([]);
    expect(mockTx.location.findMany).not.toHaveBeenCalled();
  });

  it("exports and delegates getOperationalContext from server entrypoint", async () => {
    mockTx.branch.findMany.mockResolvedValueOnce([]);
    const result = await getOperationalContext(adminActor);
    expect(result.tenantId).toBe(adminActor.tenantId);
  });
});
