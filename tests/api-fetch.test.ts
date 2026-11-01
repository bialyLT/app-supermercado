import { describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "../src/client/api-fetch";

describe("apiFetch", () => {
  it("maps HTTP errors to safe actionable errors without leaking response text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "INTERNAL_DB_ERROR", detail: "select * from secret" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    ));

    await expect(apiFetch("/api/test")).rejects.toMatchObject({
      status: 500,
      code: "REQUEST_FAILED",
      message: "No pudimos completar la operación. Intentá nuevamente.",
    });
  });

  it("emits session expiration and preserves the caller's request options", async () => {
    const listener = vi.fn();
    vi.stubGlobal("window", { dispatchEvent: listener });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    await expect(apiFetch("/api/test", {
      method: "POST",
      headers: { "x-idempotency-key": "same-command" },
      body: "{}",
    })).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledOnce();
  });

  it("maps a network failure to a recoverable status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiFetch("/api/test")).rejects.toMatchObject({
      status: 0,
      code: "REQUEST_FAILED",
    });
  });
});
