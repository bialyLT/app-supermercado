import { describe, expect, it, vi } from "vitest";
import { GET as getReceipts, POST as postReceipt } from "../../app/api/admin/inventory/receipts/route";
import { GET as getAlerts } from "../../app/api/admin/inventory/alerts/route";
import { GET as getIntakes } from "../../app/api/admin/inventory/intakes/route";
import { GET as getIntake } from "../../app/api/admin/inventory/intakes/[id]/route";
import { POST as reviewIntake } from "../../app/api/admin/inventory/intakes/[id]/review/route";

vi.mock("../../src/auth/authorization", () => ({ requirePermission: vi.fn() }));
vi.mock("../../src/auth/session", () => ({ getServerActor: vi.fn() }));
vi.mock("../../src/server/inventory", () => ({
  listInventoryReceipts: vi.fn(),
  recordReceipt: vi.fn(),
  listInventoryAlerts: vi.fn(),
  listUnverifiedIntakes: vi.fn(),
  getUnverifiedIntake: vi.fn(),
  reviewUnverifiedIntake: vi.fn(),
}));

import { requirePermission } from "../../src/auth/authorization";
import { getServerActor } from "../../src/auth/session";
import {
  getUnverifiedIntake, listInventoryAlerts, listInventoryReceipts, listUnverifiedIntakes, recordReceipt, reviewUnverifiedIntake,
} from "../../src/server/inventory";
import { InventoryError } from "../../src/domain/inventory";

const actor = {
  tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222",
  role: "STOCK_MANAGER" as const, branchIds: ["33333333-3333-4333-8333-333333333333"], permissions: [],
};
const identity = {
  userId: actor.userId, tenantId: actor.tenantId, roles: ["STOCK_MANAGER" as const], branchIds: actor.branchIds,
};
const id = "44444444-4444-4444-8444-444444444444";

describe("operational inventory HTTP contracts", () => {
  it("maps absent sessions and insufficient roles without invoking services", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new Error("UNAUTHENTICATED"));
    expect((await getReceipts()).status).toBe(401);
    vi.mocked(requirePermission).mockRejectedValueOnce(new Error("FORBIDDEN"));
    expect((await getAlerts()).status).toBe(403);
    expect(listInventoryReceipts).not.toHaveBeenCalled();
    expect(listInventoryAlerts).not.toHaveBeenCalled();
  });

  it("uses the server actor and exposes read-only collections", async () => {
    vi.mocked(requirePermission).mockResolvedValue(identity);
    vi.mocked(getServerActor).mockResolvedValue(actor);
    vi.mocked(listInventoryReceipts).mockResolvedValue({ receipts: [] });
    vi.mocked(listInventoryAlerts).mockResolvedValue({ alerts: [], intakesByCashier: [] });
    vi.mocked(listUnverifiedIntakes).mockResolvedValue({ intakes: [] });
    vi.mocked(recordReceipt).mockResolvedValue({ id, type: "RECEIPT" });
    expect((await getReceipts()).status).toBe(200);
    expect((await getAlerts()).status).toBe(200);
    expect((await getIntakes()).status).toBe(200);
    expect(vi.mocked(listInventoryReceipts).mock.calls[0]?.[0]).toBe(actor);
    const invalid = await postReceipt(new Request("http://localhost", { method: "POST", body: "{}" }));
    expect(invalid.status).toBe(400);
    const valid = await postReceipt(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        locationId: id, variantId: id, quantity: "1", reason: "cycle count", idempotencyKey: "cmd-1",
      }),
    }));
    expect(valid.status).toBe(201);
    expect(vi.mocked(recordReceipt).mock.calls[0]?.[0]).toBe(actor);
  });

  it("hides out-of-scope detail and validates review payloads", async () => {
    vi.mocked(requirePermission).mockResolvedValue(identity);
    vi.mocked(getServerActor).mockResolvedValue(actor);
    vi.mocked(getUnverifiedIntake).mockRejectedValueOnce(new InventoryError("NOT_FOUND"));
    expect((await getIntake(new Request("http://localhost"), { params: Promise.resolve({ id }) })).status).toBe(404);
    const invalid = await reviewIntake(new Request("http://localhost", {
      method: "POST", body: JSON.stringify({ decision: "CONFIRMED" }),
    }), { params: Promise.resolve({ id }) });
    expect(invalid.status).toBe(400);
    expect(reviewUnverifiedIntake).not.toHaveBeenCalled();
  });

  it("uses the canonical review permission for supervisors and maps unexpected failures to 500", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      ...identity,
      roles: ["SUPERVISOR"],
    });
    vi.mocked(getServerActor).mockResolvedValue({ ...actor, role: "SUPERVISOR" });
    vi.mocked(listUnverifiedIntakes).mockRejectedValueOnce(new Error("database unavailable"));
    expect((await getIntakes()).status).toBe(500);
    expect(vi.mocked(requirePermission)).toHaveBeenLastCalledWith("inventory.unverified_intake.review");
    vi.mocked(reviewUnverifiedIntake).mockResolvedValueOnce({ id, type: "REVIEW" });
    const response = await reviewIntake(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ decision: "REJECTED", reason: "Wrong item", idempotencyKey: "review-1" }),
    }), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(vi.mocked(requirePermission)).toHaveBeenLastCalledWith("inventory.unverified_intake.review");
  });

  it("rejects quantities outside DECIMAL(18,6) at the HTTP boundary", async () => {
    vi.mocked(requirePermission).mockResolvedValue(identity);
    vi.mocked(getServerActor).mockResolvedValue(actor);
    const response = await postReceipt(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        locationId: id, variantId: id, quantity: "1000000000000", reason: "too large", idempotencyKey: "cmd-range",
      }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "INVALID_INPUT" });
    expect(recordReceipt).not.toHaveBeenCalled();
    const correction = await reviewIntake(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        decision: "CORRECTED", correctionQuantity: "1000000000000", reason: "too large", idempotencyKey: "review-range",
      }),
    }), { params: Promise.resolve({ id }) });
    expect(correction.status).toBe(400);
    expect(await correction.json()).toMatchObject({ error: "INVALID_INPUT" });
    expect(reviewUnverifiedIntake).not.toHaveBeenCalled();
  });
});
