import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { databaseUrl } from "../../config/env";

const shared = globalThis as typeof globalThis & { inventoryPrisma?: PrismaClient; identityPrisma?: PrismaClient };
function client(auth: boolean): PrismaClient {
  const key = auth ? "identityPrisma" : "inventoryPrisma";
  shared[key] ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl(auth ? "AUTH_DATABASE_URL" : "DATABASE_URL"), max: 25 }) });
  return shared[key];
}

// Better Auth accepts a client during module evaluation. Connect only on first use.
function lazyClient(auth: boolean) { return new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client(auth);
    const value: unknown = Reflect.get(instance, property);
    return typeof value === "function" ? value.bind(instance) : value;
  },
}); }
export const prisma = lazyClient(false);
export const authPrisma = lazyClient(true);
