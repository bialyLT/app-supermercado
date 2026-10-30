import { NextResponse } from "next/server";
import { requirePermission } from "../../../../src/auth/authorization";
import { getServerActor } from "../../../../src/auth/session";
import {
  ContextError,
  contextHttpStatus,
  getOperationalContext,
} from "../../../../src/server/context";

function errorResponse(error: unknown) {
  if (error instanceof ContextError) {
    return NextResponse.json(
      { error: error.code },
      { status: contextHttpStatus(error) },
    );
  }
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "TENANT_ACCESS_DENIED")) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ error: "REQUEST_FAILED" }, { status: 400 });
}

export async function GET() {
  try {
    // Inventory write covers staff authorized for operational forms (purchases, transfers)
    await requirePermission("inventory:write");
    const actor = await getServerActor();
    const context = await getOperationalContext(actor);
    return NextResponse.json(context);
  } catch (error) {
    return errorResponse(error);
  }
}
