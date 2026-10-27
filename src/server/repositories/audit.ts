import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export async function appendAuditLog(input: {
  tenantId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${input.tenantId}, true)`;
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousValue: input.previousValue,
      newValue: input.newValue,
      ipAddress: input.ipAddress,
    },
  });
  });
}
