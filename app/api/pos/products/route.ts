import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerActor } from "../../../../src/auth/session";
import { createCatalogItem } from "../../../../src/server/repositories/catalog";
import { recordSyncConflict } from "../../../../src/server/repositories/sync-conflict";

export async function POST(request: Request) {
  let raw: Record<string, unknown> = {};
  let commandId: string | undefined;
  try {
    const actor = await getServerActor();
    raw = await request.json() as Record<string, unknown>;
    commandId = typeof raw.commandId === "string" ? raw.commandId : undefined;
    const input = { ...raw };
    delete input.commandId;
    const product = await createCatalogItem(actor, input as Parameters<typeof createCatalogItem>[1]);
    return NextResponse.json({ id: product.id, type: "PRODUCT_CREATE" }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const conflict = commandId ? await recordSyncConflict(await getServerActor(), {
        commandId, kind: "PRODUCT_DUPLICATE", payload: raw as unknown as Parameters<typeof recordSyncConflict>[1]["payload"],
      }) : null;
      return NextResponse.json({ error: "PRODUCT_DUPLICATE", conflictId: conflict?.id }, { status: 409 });
    }
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}
