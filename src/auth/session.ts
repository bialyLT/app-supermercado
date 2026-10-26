import { headers } from "next/headers";
import { auth } from "./config";
import { prisma } from "../server/db";

export async function getServerIdentity() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, active: true },
    include: { roles: { include: { role: true } }, branches: true },
  });
  if (!user) return null;
  return {
    userId: user.id,
    tenantId: user.tenantId,
    roles: user.roles.map(({ role }) => role.name),
    branchIds: user.branches.map(({ branchId }) => branchId),
  };
}
