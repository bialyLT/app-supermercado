import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../../src/auth/authorization";
import { getServerActor } from "../../../../../src/auth/session";
import {
  PurchaseError,
  purchaseHttpStatus,
  supplierInputSchema,
} from "../../../../../src/domain/purchases";
import {
  createSupplier,
  listSuppliers,
} from "../../../../../src/server/purchases";

function errorResponse(error: unknown) {
  if (error instanceof PurchaseError) {
    return NextResponse.json(
      { error: error.code, detail: error.detail },
      { status: purchaseHttpStatus(error) },
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: error.issues }, { status: 400 });
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
    await requirePermission("inventory:write");
    const actor = await getServerActor();
    const suppliers = await listSuppliers(actor);
    return NextResponse.json({ suppliers, tenantId: actor.tenantId });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = supplierInputSchema.parse(json);
    await requirePermission("inventory:write");
    const actor = await getServerActor();
    const supplier = await createSupplier(actor, input);
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
