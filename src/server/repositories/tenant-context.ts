import { Prisma, type PrismaClient } from "@prisma/client";
import type { Actor } from "../../domain/actor";

export type TransactionClient = Prisma.TransactionClient;

export async function withTenant<T>(
  client: PrismaClient,
  actor: Actor,
  operation: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return client.$transaction(async (tx) => {
    const roles = await tx.$queryRaw<{ unsafe: boolean }[]>`
      SELECT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole
        OR NOT pg_has_role(current_user, 'supermercado_app', 'member')
        OR pg_has_role(current_user, 'supermercado_auth', 'member')
        OR EXISTS (SELECT 1 FROM pg_database WHERE datname = current_database() AND datdba = pg_roles.oid)
        OR EXISTS (SELECT 1 FROM pg_class WHERE relowner = pg_roles.oid AND relname = 'InventoryLevel')) AS unsafe
      FROM pg_roles WHERE rolname = current_user`;
    if (roles[0]?.unsafe !== false) throw new Error("UNSAFE_DATABASE_ROLE");
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${actor.tenantId}, true)`;
    return operation(tx);
  }, { maxWait: 30000, timeout: 30000 });
}

export function tenantWhere(actor: Actor): Prisma.TenantWhereInput {
  return { id: actor.tenantId };
}
