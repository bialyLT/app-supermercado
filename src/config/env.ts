import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
});

// Database-independent tools can load modules; an actual connection always requires a URL.
export function databaseUrl(name: "DATABASE_URL" | "AUTH_DATABASE_URL" = "DATABASE_URL"): string {
  return z.string().url().parse(process.env[name]);
}

const developmentSecret = "development-only-change-me-32-characters";
export function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || [developmentSecret, "replace-with-at-least-32-random-characters"].includes(secret))) {
    throw new Error("AUTH_SECRET_REQUIRED");
  }
  return z.string().min(32).parse(secret ?? developmentSecret);
}
