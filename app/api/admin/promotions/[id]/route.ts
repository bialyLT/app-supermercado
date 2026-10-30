import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../../src/auth/authorization";
import { appendAuditLog } from "../../../../../src/server/audit";
import { promotionConfigSchema } from "../../../../../src/domain/promotions";
import { deactivatePromotion, updatePromotion } from "../../../../../src/server/repositories/promotions";
import { getServerActor } from "../../../../../src/auth/session";

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const input = promotionConfigSchema.parse(await request.json());
    const identity = await requirePermission("settings:write", input.branchId ?? undefined);
    const promotion = await updatePromotion(await getServerActor(), id, input);
    await appendAuditLog({
      tenantId: identity.tenantId,
      actorUserId: identity.userId,
      action: "promotion.updated",
      entityType: "Promotion",
      entityId: promotion.id,
      newValue: promotion,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
    return NextResponse.json(promotion);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const identity = await requirePermission("settings:write");
    const promotion = await deactivatePromotion(await getServerActor(), id);
    await appendAuditLog({
      tenantId: identity.tenantId,
      actorUserId: identity.userId,
      action: "promotion.deactivated",
      entityType: "Promotion",
      entityId: promotion.id,
      newValue: { active: false },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
    return NextResponse.json(promotion);
  } catch (error) {
    return errorResponse(error);
  }
}
