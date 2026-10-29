import { NextResponse } from "next/server";
import { getServerActor } from "../../../../../src/auth/session";
import { resolvePriceWeighedBarcode } from "../../../../../src/server/repositories/catalog";
import { InventoryError, httpStatus } from "../../../../../src/domain/inventory";

export async function GET(request: Request) {
  try {
    const actor = await getServerActor();
    const code = new URL(request.url).searchParams.get("code") ?? "";
    return NextResponse.json(await resolvePriceWeighedBarcode(actor, code));
  } catch (error) {
    if (error instanceof InventoryError) return NextResponse.json({ error: error.code }, { status: httpStatus(error) });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
}
