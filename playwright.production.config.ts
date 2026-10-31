import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/production-csp.spec.ts",
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3110",
    url: "http://127.0.0.1:3110",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      BETTER_AUTH_URL: "http://127.0.0.1:3110",
      BETTER_AUTH_SECRET: "development-only-change-me-32-characters",
    },
  },
  use: { baseURL: "http://127.0.0.1:3110", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
