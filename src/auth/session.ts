import { headers } from "next/headers";
import { getAuth } from "./config";
import { findIdentity } from "../server/repositories/identity";
import { inventoryPermissions } from "../server/repositories/inventory";
import type { Actor } from "../domain/actor";

async function serverContext() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const identity = await findIdentity(session.user.id);
  return identity ? { ...identity, sessionId: session.session.id } : null;
}

export async function getServerIdentity() {
  const context = await serverContext();
  return context ? { userId: context.userId, tenantId: context.tenantId, roles: context.roles, branchIds: context.branchIds } : null;
}

export async function getServerActor(): Promise<Actor> {
  const identity = await serverContext();
  const role = identity?.roles[0];
  if (!identity || !role) throw new Error("UNAUTHENTICATED");
  return { ...identity, role, permissions: [...new Set(identity.roles.flatMap((value) => inventoryPermissions[value]))] };
}
