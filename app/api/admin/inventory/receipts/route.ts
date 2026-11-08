import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../../src/auth/authorization";
import { getServerActor } from "../../../../../src/auth/session";
import { InventoryError, httpStatus, receiptSchema } from "../../../../../src/domain/inventory";
import { listInventoryReceipts, recordReceipt } from "../../../../../src/server/inventory";

function errorResponse(error: unknown) {
  if (error instanceof InventoryError) return NextResponse.json({ error: error.code }, { status: httpStatus(error) });
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 500 });
}

export async function GET() {
  try {
    await requirePermission("inventory.ledger.read");
    return NextResponse.json(await listInventoryReceipts(await getServerActor()));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = receiptSchema.parse(await request.json());
    // The application authorization map grants stock managers the inventory
    // administration capability; the transaction re-checks receive explicitly.
    await requirePermission("inventory:write");
    const result = await recordReceipt(await getServerActor(), input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT", issues: error.issues }, { status: 400 });
    return errorResponse(error);
  }
}
