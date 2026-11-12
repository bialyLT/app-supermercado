import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/client/api-fetch";
import { signOut } from "../src/client/sign-out";

describe("client sign-out", () => {
  it("posts JSON so Better Auth does not answer 415", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    const result = await signOut(fetcher);

    expect(result).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/auth/sign-out");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(init.body).toBe("{}");
  });

  it("reports a failure instead of pretending the session ended", async () => {
    const fetcher = vi.fn(async () => {
      throw new ApiError(415, "REQUEST_FAILED", "No pudimos completar la operación. Intentá nuevamente.");
    });
    const result = await signOut(fetcher);

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("No pudimos completar la operación");
  });

  it("never lets a rejected promise escape to the caller", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(signOut(fetcher)).resolves.toMatchObject({ ok: false });
  });
});
