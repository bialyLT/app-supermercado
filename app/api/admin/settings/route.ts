import { NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditLog } from "../../../../src/server/audit";
import { requirePermission } from "../../../../src/auth/authorization";
import { checkRateLimit } from "../../../../src/server/rate-limit";

const settingsSchema = z.object({
  setting: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(200),
  branchId: z.string().uuid().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkRateLimit(`sensitive:${ip}`, 30, 60 * 1000)) {
      return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
    }
    const body = settingsSchema.parse(await request.json());
    const identity = await requirePermission("settings:write", body.branchId);
    await appendAuditLog({
      tenantId: identity.tenantId,
      actorUserId: identity.userId,
      action: "settings.updated",
      entityType: "Settings",
      newValue: { setting: body.setting, value: body.value },
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
}
