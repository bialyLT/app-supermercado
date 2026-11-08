import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../../../../src/auth/authorization";
import { getServerActor } from "../../../../../../../src/auth/session";
import { InventoryError, httpStatus, reviewSchema } from "../../../../../../../src/domain/inventory";
import { reviewUnverifiedIntake } from "../../../../../../../src/server/inventory";

function errorResponse(error: unknown) {
  if (error instanceof InventoryError) return NextResponse.json({ error: error.code }, { status: httpStatus(error) });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT", issues: error.issues }, { status: 400 });
  if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 500 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("inventory.unverified_intake.review");
    const { id } = await params;
    const input = reviewSchema.parse({ ...await request.json(), reviewId: id });
    const result = await reviewUnverifiedIntake(await getServerActor(), input);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
