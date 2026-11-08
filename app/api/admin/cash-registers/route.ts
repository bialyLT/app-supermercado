import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../src/auth/authorization";
import { getServerActor } from "../../../../src/auth/session";
import { assignCashRegisterLocation, listCashRegisterAssignments } from "../../../../src/server/cash";
import { InventoryError } from "../../../../src/domain/inventory";

const assignmentSchema = z.object({ registerId: z.string().uuid(), locationId: z.string().uuid() }).strict();

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  if (error instanceof InventoryError) {
    if (error.code === "NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (error.code === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    return NextResponse.json({ error: error.code }, { status: 400 });
  }
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
}

export async function GET() {
  try {
    await requirePermission("cash.register.manage");
    return NextResponse.json(await listCashRegisterAssignments(await getServerActor()));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePermission("cash.register.manage");
    const input = assignmentSchema.parse(await request.json());
    const actor = await getServerActor();
    return NextResponse.json(await assignCashRegisterLocation(actor, input));
  } catch (error) {
    return errorResponse(error);
  }
}
