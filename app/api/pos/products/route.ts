import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerActor } from "../../../../src/auth/session";
import { createCatalogItem } from "../../../../src/server/repositories/catalog";

export async function POST(request: Request) {
  try {
    const actor = await getServerActor();
    const product = await createCatalogItem(actor, await request.json());
    return NextResponse.json({ id: product.id, type: "PRODUCT_CREATE" }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "PRODUCT_DUPLICATE" }, { status: 409 });
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}
