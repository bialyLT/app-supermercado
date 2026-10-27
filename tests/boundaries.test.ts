import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

describe("enforced architecture boundaries", () => {
  const eslint = new ESLint();
  // Next's ESLint config has a costly cold import under V8 coverage; assertions do not measure startup time.
  beforeAll(async () => { await eslint.calculateConfigForFile("src/auth/probe.ts"); }, 30000);
  it.each(["@prisma/client", "@prisma/adapter-pg", "../server/repositories/client"])("rejects %s outside repositories", async (source) => {
    const [result] = await eslint.lintText(`import { PrismaClient } from "${source}"; export const forbidden = PrismaClient;`, { filePath: "src/auth/probe.ts" });
    expect(result.messages.some((message) => message.ruleId === "no-restricted-imports")).toBe(true);
  });
  it("rejects domain imports of infrastructure", async () => {
    const [result] = await eslint.lintText('import { prisma } from "../server/repositories/client"; export const forbidden = prisma;', { filePath: "src/domain/probe.ts" });
    expect(result.messages.some((message) => message.ruleId === "no-restricted-imports")).toBe(true);
  });
});
