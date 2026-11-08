import { describe, expect, it, vi } from "vitest";
import { getQueueStateLabel, replayOfflineCommand, type OfflineCommand } from "../src/pos/offline-queue";
import { ApiError } from "../src/client/api-fetch";

describe("offline queue state labels", () => {
  it.each([
    ["pending", "Pendientes"],
    ["processing", "Procesando"],
    ["completed", "Completados"],
    ["conflict", "Conflictos"],
    ["error", "Requieren reintento"],
  ] as const)("labels %s", (state, label) => {
    expect(getQueueStateLabel(state)).toBe(label);
  });

  describe("offline replay", () => {
    const command: OfflineCommand = {
      commandId: "cmd-1",
      kind: "SALE",
      endpoint: "/api/pos/checkout",
      payload: { idempotencyKey: "cmd-1" },
      createdAt: 1,
    };

    it("uses the shared request flow and preserves a command on session expiry", async () => {
      const request = vi.fn().mockRejectedValue(new ApiError(401, "UNAUTHORIZED", "Tu sesión venció."));
      await expect(replayOfflineCommand(command, request)).resolves.toEqual({
        state: "error",
        lastError: "Sesión vencida. Volvé a ingresar.",
      });
      expect(request).toHaveBeenCalledWith(command.endpoint, expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-idempotency-key": "cmd-1" }),
      }));
    });

    it("marks recoverable network failures for retry", async () => {
      const request = vi.fn().mockRejectedValue(new ApiError(0, "REQUEST_FAILED", "No hay conexión."));
      await expect(replayOfflineCommand(command, request)).resolves.toEqual({
        state: "error",
        lastError: "Sin conexión. Reintentá cuando vuelva la red.",
      });
    });
  });
});
