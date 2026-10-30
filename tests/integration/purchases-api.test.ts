import { describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../app/api/admin/purchases/route";
import { PurchaseError } from "../../src/domain/purchases";

vi.mock("../../src/auth/authorization", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("../../src/auth/session", () => ({
  getServerActor: vi.fn(),
}));

vi.mock("../../src/server/purchases", () => ({
  createDirectPurchaseReceipt: vi.fn(),
  listPurchaseReceipts: vi.fn(),
}));

import { requirePermission } from "../../src/auth/authorization";
import { getServerActor } from "../../src/auth/session";
import {
  createDirectPurchaseReceipt,
  listPurchaseReceipts,
} from "../../src/server/purchases";

const mockRequirePermission = vi.mocked(requirePermission);
const mockGetServerActor = vi.mocked(getServerActor);
const mockCreateReceipt = vi.mocked(createDirectPurchaseReceipt);
const mockListReceipts = vi.mocked(listPurchaseReceipts);

const validPayload = {
  supplierId: "a0000000-0000-4000-8000-000000000001",
  branchId: "a0000000-0000-4000-8000-000000000002",
  locationId: "a0000000-0000-4000-8000-000000000003",
  receiptNumber: "REC-001",
  currency: "ARS",
  idempotencyKey: "test-idem-key-1",
  subtotal: "50.00",
  total: "50.00",
  lines: [
    {
      variantId: "a0000000-0000-4000-8000-000000000004",
      quantity: "5",
      unitCost: "10.00",
    },
  ],
};

const adminActor = {
  tenantId: "a0000000-0000-4000-8000-000000000010",
  userId: "a0000000-0000-4000-8000-000000000011",
  role: "ADMIN" as const,
  branchIds: ["a0000000-0000-4000-8000-000000000002"],
  permissions: ["inventory.receive" as const, "inventory.write" as const],
};

describe("public-interface purchases API route (/api/admin/purchases)", () => {
  it("rejects unauthenticated requests with 401", async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error("UNAUTHENTICATED"));

    const request = new Request("http://localhost/api/admin/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "UNAUTHENTICATED" });
  });

  it("rejects requests with insufficient role with 403", async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));

    const request = new Request("http://localhost/api/admin/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "FORBIDDEN" });
  });

  it("returns 400 when body fails schema validation or has invalid totals", async () => {
    mockRequirePermission.mockResolvedValueOnce({
      userId: adminActor.userId,
      tenantId: adminActor.tenantId,
      roles: ["ADMIN"],
      branchIds: adminActor.branchIds,
    });
    mockGetServerActor.mockResolvedValueOnce(adminActor);
    mockCreateReceipt.mockRejectedValueOnce(new PurchaseError("INVALID_TOTALS", "Totals mismatch"));

    const request = new Request("http://localhost/api/admin/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validPayload,
        subtotal: "999.00",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("INVALID_TOTALS");
  });

  it("returns 409 when idempotency conflict occurs", async () => {
    mockRequirePermission.mockResolvedValueOnce({
      userId: adminActor.userId,
      tenantId: adminActor.tenantId,
      roles: ["ADMIN"],
      branchIds: adminActor.branchIds,
    });
    mockGetServerActor.mockResolvedValueOnce(adminActor);
    mockCreateReceipt.mockRejectedValueOnce(new PurchaseError("IDEMPOTENCY_CONFLICT"));

    const request = new Request("http://localhost/api/admin/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("returns 404 when location or supplier does not exist or belongs to another tenant", async () => {
    mockRequirePermission.mockResolvedValueOnce({
      userId: adminActor.userId,
      tenantId: adminActor.tenantId,
      roles: ["ADMIN"],
      branchIds: adminActor.branchIds,
    });
    mockGetServerActor.mockResolvedValueOnce(adminActor);
    mockCreateReceipt.mockRejectedValueOnce(new PurchaseError("NOT_FOUND", "Location not found"));

    const request = new Request("http://localhost/api/admin/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("NOT_FOUND");
  });

  it("creates direct purchase receipt successfully with 201 for authorized actor", async () => {
    mockRequirePermission.mockResolvedValueOnce({
      userId: adminActor.userId,
      tenantId: adminActor.tenantId,
      roles: ["ADMIN"],
      branchIds: adminActor.branchIds,
    });
    mockGetServerActor.mockResolvedValueOnce(adminActor);
    const mockCreatedReceipt = {
      id: "a0000000-0000-4000-8000-000000000099",
      tenantId: adminActor.tenantId,
      branchId: validPayload.branchId,
      locationId: validPayload.locationId,
      supplierId: validPayload.supplierId,
      subtotal: "50.00",
      taxTotal: "0.00",
      discountTotal: "0.00",
      total: "50.00",
      currency: "ARS",
      lines: [],
    };
    mockCreateReceipt.mockResolvedValueOnce(mockCreatedReceipt as unknown as Awaited<ReturnType<typeof createDirectPurchaseReceipt>>);

    const request = new Request("http://localhost/api/admin/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(mockCreatedReceipt);
  });

  it("GET /api/admin/purchases lists receipts for authorized actor", async () => {
    mockRequirePermission.mockResolvedValueOnce({
      userId: adminActor.userId,
      tenantId: adminActor.tenantId,
      roles: ["ADMIN"],
      branchIds: adminActor.branchIds,
    });
    mockGetServerActor.mockResolvedValueOnce(adminActor);
    mockListReceipts.mockResolvedValueOnce([] as unknown as Awaited<ReturnType<typeof listPurchaseReceipts>>);

    const request = new Request("http://localhost/api/admin/purchases?branchId=" + validPayload.branchId);
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      receipts: [],
      tenantId: adminActor.tenantId,
    });
  });
});
