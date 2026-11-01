import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../../src/auth/authorization";
import { getServerActor } from "../../../../../src/auth/session";
import { InventoryError, httpStatus } from "../../../../../src/domain/inventory";
import { listInventoryLevels, operationalReadQuerySchema } from "../../../../../src/server/operational-read";

export async function GET(request: Request) {
  try {
    const query = operationalReadQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    await requirePermission("inventory.level.read", query.branchId);
    return NextResponse.json(await listInventoryLevels(await getServerActor(), query));
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT", issues: error.issues }, { status: 400 });
    if (error instanceof InventoryError) return NextResponse.json({ error: error.code }, { status: httpStatus(error) });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}
