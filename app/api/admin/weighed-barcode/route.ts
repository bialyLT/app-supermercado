import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerActor } from "../../../../src/auth/session";
import { requirePermission } from "../../../../src/auth/authorization";
import { appendAuditLog } from "../../../../src/server/audit";
import { upsertWeighedBarcodeConfig } from "../../../../src/server/repositories/catalog";
import { weighedBarcodeConfigSchema } from "../../../../src/domain/weighed-barcode";

export async function POST(request: Request) {
  try {
    const input = weighedBarcodeConfigSchema.parse(await request.json());
    const identity = await requirePermission("settings:write");
    const config = await upsertWeighedBarcodeConfig(await getServerActor(), input);
    await appendAuditLog({
      tenantId: identity.tenantId,
      actorUserId: identity.userId,
      action: "weighed_barcode_config.updated",
      entityType: "WeighedBarcodeConfig",
      newValue: input,
    });
    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}
