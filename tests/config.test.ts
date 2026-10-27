import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it("does not substitute a development secret in production configuration", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BETTER_AUTH_SECRET", undefined);
  vi.resetModules();
  const config = await import("../src/config/env");
  expect(config.env.BETTER_AUTH_SECRET).toBeUndefined();
  expect(() => config.authSecret()).toThrow("AUTH_SECRET_REQUIRED");
  vi.stubEnv("BETTER_AUTH_SECRET", "development-only-change-me-32-characters");
  expect(() => config.authSecret()).toThrow("AUTH_SECRET_REQUIRED");
  vi.stubEnv("BETTER_AUTH_SECRET", "synthetic-production-fixture-secret-2026");
  expect(config.authSecret()).toBe("synthetic-production-fixture-secret-2026");
});
