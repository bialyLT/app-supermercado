import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerActor } from "../../../../src/auth/session";
import { confirmPaidMultiLineSale } from "../../../../src/server/inventory";
import { InventoryError, httpStatus, paidMultiSaleSchema } from "../../../../src/domain/inventory";

export async function POST(request: Request) {
  try {
    const actor = await getServerActor();
    const input = paidMultiSaleSchema.parse(await request.json());
    const result = await confirmPaidMultiLineSale(actor, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const details = process.env.NODE_ENV === "development"
        ? error.issues.map((issue) => ({ path: issue.path, code: issue.code, message: issue.message }))
        : undefined;
      return NextResponse.json({ error: "INVALID_INPUT", ...(details ? { details } : {}) }, { status: 400 });
    }
    if (error instanceof InventoryError) return NextResponse.json({ error: error.code }, { status: httpStatus(error) });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}
