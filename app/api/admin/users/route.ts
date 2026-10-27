import { hashPassword } from "better-auth/crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../src/auth/authorization";
import { appendAuditLog } from "../../../../src/server/audit";
import { createIdentityUser } from "../../../../src/server/repositories/identity";

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
    const user = await createIdentityUser(identity, body, password);
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
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}
