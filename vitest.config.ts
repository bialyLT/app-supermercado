import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
      exclude: [
        "tests/**",
        "**/*.config.{ts,mts}",
        "next-env.d.ts",
        "src/config/env.ts",
        // HTTP/database adapters are covered by integration and E2E gates.
        "src/auth/**",
        "src/server/**",
      ],
    },
  },
});
