import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 80,
        "src/domain/**": { lines: 90, branches: 90 },
      },
      exclude: [
        "tests/**",
        "**/*.config.{ts,mts}",
        "next-env.d.ts",
        "src/config/env.ts",
        // Session/HTTP adapter wiring is verified by E2E; inventory services stay included.
        "src/auth/**",
        "src/server/repositories/client.ts",
      ],
    },
  },
});
