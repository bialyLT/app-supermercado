import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../src/auth/authorization";
import { getServerActor } from "../../../../src/auth/session";
import { TransferError, transferHttpStatus, transferInputSchema } from "../../../../src/domain/transfers";
import { createTransfer, listTransfers } from "../../../../src/server/transfers";

function errorResponse(error: unknown) {
  if (error instanceof TransferError) return NextResponse.json({ error: error.code, detail: error.detail }, { status: transferHttpStatus(error) });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT", issues: error.issues }, { status: 400 });
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
}

export async function GET() {
  try {
    await requirePermission("inventory:write");
    const actor = await getServerActor();
    return NextResponse.json({ transfers: await listTransfers(actor) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = transferInputSchema.parse(await request.json());
    await requirePermission("inventory:write", input.originBranchId);
    const actor = await getServerActor();
    const transfer = await createTransfer(actor, input);
    return NextResponse.json(transfer, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
