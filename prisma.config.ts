import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Generation/validation do not connect. migrate still fails without a real database.
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://localhost/unconfigured",
  },
});
