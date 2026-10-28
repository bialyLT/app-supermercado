import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerActor } from "../../../../src/auth/session";
import { reverseSale } from "../../../../src/server/reversal";
import { InventoryError, httpStatus } from "../../../../src/domain/inventory";

export async function POST(request: Request) {
  try {
    const actor = await getServerActor();
    return NextResponse.json(await reverseSale(actor, await request.json()), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof InventoryError) return NextResponse.json({ error: error.code }, { status: httpStatus(error) });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}
