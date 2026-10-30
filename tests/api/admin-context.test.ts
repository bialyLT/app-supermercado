import { describe, expect, it, vi } from "vitest";
import { GET } from "../../app/api/admin/context/route";

vi.mock("../../src/auth/authorization", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("../../src/auth/session", () => ({
  getServerActor: vi.fn(),
}));

vi.mock("../../src/server/context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/server/context")>();
  return {
    ...actual,
    getOperationalContext: vi.fn(),
  };
});

import { requirePermission } from "../../src/auth/authorization";
import { getServerActor } from "../../src/auth/session";
import { getOperationalContext } from "../../src/server/context";

const mockRequirePermission = vi.mocked(requirePermission);
const mockGetServerActor = vi.mocked(getServerActor);
const mockGetOperationalContext = vi.mocked(getOperationalContext);

const authorizedActor = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  role: "STOCK_MANAGER" as const,
  branchIds: ["33333333-3333-4333-8333-333333333333"],
  permissions: ["inventory.write" as const],
};

const mockContextData = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  branches: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      code: "CENTRAL",
      name: "Sucursal Central",
      locations: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          code: "DEP-01",
          name: "Depósito Principal",
          type: "WAREHOUSE",
          branchId: "33333333-3333-4333-8333-333333333333",
          active: true,
        },
      ],
    },
  ],
  locations: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      code: "DEP-01",
      name: "Depósito Principal",
      type: "WAREHOUSE",
      branchId: "33333333-3333-4333-8333-333333333333",
      active: true,
    },
  ],
};

describe("public-interface operational context API route (/api/admin/context)", () => {
  it("rejects unauthenticated requests with 401", async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));

    const response = await GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("rejects unauthorized actors with 403", async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));

    const response = await GET();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "FORBIDDEN" });
  });

  it("returns 200 with tenant-scoped branches and locations for authorized actor", async () => {
    mockRequirePermission.mockResolvedValueOnce({
      userId: authorizedActor.userId,
      tenantId: authorizedActor.tenantId,
      roles: ["STOCK_MANAGER"],
      branchIds: [...authorizedActor.branchIds],
    });
    mockGetServerActor.mockResolvedValueOnce(authorizedActor);
    mockGetOperationalContext.mockResolvedValueOnce(mockContextData);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(mockContextData);
    expect(body.tenantId).toBe(authorizedActor.tenantId);
    expect(body.branches).toHaveLength(1);
    expect(body.branches[0].locations).toHaveLength(1);
    expect(body.locations).toHaveLength(1);
    expect(mockGetOperationalContext).toHaveBeenCalledWith(authorizedActor);
  });

  it("ignores any client-provided tenantId or branch authority", async () => {
    mockRequirePermission.mockResolvedValueOnce({
      userId: authorizedActor.userId,
      tenantId: authorizedActor.tenantId,
      roles: ["STOCK_MANAGER"],
      branchIds: [...authorizedActor.branchIds],
    });
    mockGetServerActor.mockResolvedValueOnce(authorizedActor);
    mockGetOperationalContext.mockResolvedValueOnce(mockContextData);

    // Call GET without any reliance on client URL params or body
    const response = await GET();
    expect(response.status).toBe(200);
    // Context is strictly fetched using actor from server session
    expect(mockGetOperationalContext).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: authorizedActor.tenantId })
    );
  });
});
