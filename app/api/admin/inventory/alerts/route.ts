import { NextResponse } from "next/server";
import { requirePermission } from "../../../../../src/auth/authorization";
import { getServerActor } from "../../../../../src/auth/session";
import { InventoryError, httpStatus } from "../../../../../src/domain/inventory";
import { listInventoryAlerts } from "../../../../../src/server/inventory";

export async function GET() {
  try {
    await requirePermission("inventory.unverified_intake.review");
    return NextResponse.json(await listInventoryAlerts(await getServerActor()));
  } catch (error) {
    if (error instanceof InventoryError) return NextResponse.json({ error: error.code }, { status: httpStatus(error) });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 500 });
  }
}
