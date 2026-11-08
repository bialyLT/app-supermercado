import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerActor } from "../../../../src/auth/session";
import { catalogRequestInput, createCatalogItemCommand } from "../../../../src/server/repositories/catalog";
import { recordSyncConflict } from "../../../../src/server/repositories/sync-conflict";
import { InventoryError } from "../../../../src/domain/inventory";

export async function POST(request: Request) {
  let commandId: string | undefined;
  try {
    const actor = await getServerActor();
    const input = catalogRequestInput.parse(await request.json());
    commandId = input.commandId;
    const result = await createCatalogItemCommand(actor, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (error instanceof InventoryError && error.message === "IDEMPOTENCY_CONFLICT") {
      return NextResponse.json({ error: "IDEMPOTENCY_CONFLICT" }, { status: 409 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const conflict = commandId ? await recordSyncConflict(await getServerActor(), {
        commandId, kind: "PRODUCT_DUPLICATE", payload: { error: "PRODUCT_DUPLICATE" },
      }) : null;
      return NextResponse.json({ error: "PRODUCT_DUPLICATE", conflictId: conflict?.id }, { status: 409 });
    }
    return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
  }
}
