import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../src/auth/authorization";
import { appendAuditLog } from "../../../../src/server/audit";
import { promotionConfigSchema } from "../../../../src/domain/promotions";
import { createPromotion, listPromotions } from "../../../../src/server/repositories/promotions";
import { getServerActor } from "../../../../src/auth/session";

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
}

export async function GET() {
  try {
    const identity = await requirePermission("settings:write");
    const promotions = await listPromotions(await getServerActor());
    return NextResponse.json({ promotions, tenantId: identity.tenantId });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = promotionConfigSchema.parse(await request.json());
    const identity = await requirePermission("settings:write", input.branchId ?? undefined);
    const promotion = await createPromotion(await getServerActor(), input);
    await appendAuditLog({
      tenantId: identity.tenantId,
      actorUserId: identity.userId,
      action: "promotion.created",
      entityType: "Promotion",
      entityId: promotion.id,
      newValue: promotion,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    });
    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
