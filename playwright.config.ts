import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3109",
    url: "http://127.0.0.1:3109", reuseExistingServer: false,
    env: { BETTER_AUTH_URL: "http://127.0.0.1:3109" },
  },
  use: { baseURL: "http://127.0.0.1:3109", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
