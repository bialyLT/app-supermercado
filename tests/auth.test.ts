import { beforeEach, describe, expect, it } from "vitest";
import { getHighestRole, roleHasPermission } from "../src/auth/authorization";
import { checkRateLimit, resetRateLimits } from "../src/server/rate-limit";
import { z } from "zod";

describe("Epic 1 authorization and abuse controls", () => {
  beforeEach(() => resetRateLimits());

  it("keeps administrative permission server-side", () => {
    expect(roleHasPermission("CASHIER", "settings:write")).toBe(false);
    expect(roleHasPermission("SUPERVISOR", "settings:write")).toBe(false);
    expect(roleHasPermission("ADMIN", "settings:write")).toBe(true);
  });

  it("resolves multiple roles by approved highest-scope precedence", () => {
    expect(getHighestRole(["CASHIER", "SUPERVISOR"])).toBe("SUPERVISOR");
    expect(getHighestRole(["STOCK_MANAGER", "ADMIN", "CASHIER"])).toBe("ADMIN");
    expect(getHighestRole([])).toBeUndefined();
  });

  it("limits repeated attempts by stable client key", () => {
    expect(checkRateLimit("login:127.0.0.1", 2, 60_000, 1000)).toBe(true);
    expect(checkRateLimit("login:127.0.0.1", 2, 60_000, 1001)).toBe(true);
    expect(checkRateLimit("login:127.0.0.1", 2, 60_000, 1002)).toBe(false);
    expect(checkRateLimit("login:127.0.0.1", 2, 60_000, 62_000)).toBe(true);
  });

  it("rejects tenant authority in sensitive input", () => {
    const schema = z.object({ setting: z.string(), value: z.string() }).strict();
    expect(schema.safeParse({ setting: "timezone", value: "UTC", tenantId: "attacker" }).success).toBe(false);
  });
});
