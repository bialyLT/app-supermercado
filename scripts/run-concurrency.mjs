import { spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL || !process.env.TEST_DATABASE_URL) {
  throw new Error("Concurrency gate requires DATABASE_URL and TEST_DATABASE_URL; skipping is not a passing gate");
}
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/integration/epic2-concurrency.test.ts"], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
