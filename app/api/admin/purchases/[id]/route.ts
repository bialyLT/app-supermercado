import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "../../../../../src/auth/authorization";
import { getServerActor } from "../../../../../src/auth/session";
import {
  PurchaseError,
  purchaseHttpStatus,
} from "../../../../../src/domain/purchases";
import { getPurchaseReceipt } from "../../../../../src/server/purchases";

function errorResponse(error: unknown) {
  if (error instanceof PurchaseError) {
    return NextResponse.json(
      { error: error.code, detail: error.detail },
      { status: purchaseHttpStatus(error) },
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
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

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    await requirePermission("inventory:write");
    const actor = await getServerActor();
    const receipt = await getPurchaseReceipt(actor, id);
    return NextResponse.json(receipt);
  } catch (error) {
    return errorResponse(error);
  }
}
