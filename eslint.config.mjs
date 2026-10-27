import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: ["src/server/repositories/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@prisma/client", "@prisma/adapter-*", "**/repositories/client", "**/server/db", "./db"], message: "Prisma is restricted to repositories." },
        ],
      }],
    },
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: ["@prisma/*", "next", "next/**", "**/server/**", "**/auth/**"] }],
      "no-restricted-syntax": ["error", { selector: "NewExpression[callee.name='Date']", message: "Inject the clock into domain functions." }],
    },
  },
  globalIgnores([".next/**", "node_modules/**", "coverage/**", "prisma/migrations/**", "next-env.d.ts"]),
]);
