import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../src/auth/authorization";
import { getServerActor } from "../../../../src/auth/session";
import {
  PurchaseError,
  directPurchaseReceiptInputSchema,
  purchaseHttpStatus,
} from "../../../../src/domain/purchases";
import {
  createDirectPurchaseReceipt,
  listPurchaseReceipts,
} from "../../../../src/server/purchases";

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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const branchId = url.searchParams.get("branchId") ?? undefined;
    const supplierId = url.searchParams.get("supplierId") ?? undefined;

    await requirePermission("inventory:write", branchId);
    const actor = await getServerActor();
    const receipts = await listPurchaseReceipts(actor, { branchId, supplierId });
    return NextResponse.json({ receipts, tenantId: actor.tenantId });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = directPurchaseReceiptInputSchema.parse(json);
    await requirePermission("inventory:write", input.branchId);
    const actor = await getServerActor();
    const receipt = await createDirectPurchaseReceipt(actor, input);
    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
