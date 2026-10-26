import { hashPassword } from "better-auth/crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../src/auth/authorization";
import { appendAuditLog } from "../../../../src/server/audit";
import { prisma } from "../../../../src/server/db";

const userSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(128),
  role: z.enum(["CASHIER", "SUPERVISOR", "STOCK_MANAGER", "ADMIN"]),
  branchId: z.string().uuid().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const body = userSchema.parse(await request.json());
    const identity = await requirePermission("settings:write", body.branchId);
    const password = await hashPassword(body.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: identity.tenantId,
          email: body.email.toLowerCase(),
          displayName: body.displayName,
          name: body.displayName,
          active: true,
        },
      });
      const role = await tx.role.upsert({
        where: { tenantId_name: { tenantId: identity.tenantId, name: body.role } },
        update: {},
        create: { tenantId: identity.tenantId, name: body.role },
      });
      await tx.userRole.create({ data: { tenantId: identity.tenantId, userId: created.id, roleId: role.id } });
      if (body.branchId) {
        await tx.userBranch.create({
          data: { tenantId: identity.tenantId, userId: created.id, branchId: body.branchId },
        });
      }
      await tx.account.create({
        data: { id: crypto.randomUUID(), accountId: created.email, providerId: "credential", userId: created.id, password },
      });
      return created;
    });
    await appendAuditLog({
      tenantId: identity.tenantId,
      actorUserId: identity.userId,
      action: "user.created",
      entityType: "User",
      entityId: user.id,
      newValue: { email: user.email, role: body.role, branchId: body.branchId ?? null },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}
